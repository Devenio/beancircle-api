import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BugCategory, BugSeverity } from '@prisma/client';
import { createHash } from 'crypto';

export interface TriageInput {
  title: string;
  description: string;
  category: BugCategory;
  route?: string | null;
  logs?: unknown;
  deviceInfo?: unknown;
  appInfo?: unknown;
}

export interface TriageResult {
  summary: string;
  probableCause: string;
  severity: BugSeverity;
  reproSteps: string[];
  /** True when produced by the LLM, false for the deterministic fallback. */
  aiGenerated: boolean;
}

/**
 * AI bug triage. Calls Claude (Anthropic Messages API) when ANTHROPIC_API_KEY
 * is configured; otherwise falls back to a deterministic heuristic so the
 * feature degrades gracefully with no external dependency.
 */
@Injectable()
export class BugTriageService {
  private readonly logger = new Logger(BugTriageService.name);
  private readonly apiKey?: string;
  private readonly model: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('ANTHROPIC_API_KEY') || undefined;
    this.model = config.get<string>('BUG_TRIAGE_MODEL') || 'claude-haiku-4-5';
  }

  get enabled(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * Stable fingerprint used to group duplicate reports. Normalises the title
   * by lowercasing and stripping volatile tokens (numbers, uuids, hex), then
   * hashes it together with the category.
   */
  fingerprint(title: string, category: BugCategory): string {
    const normalized = title
      .toLowerCase()
      .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/g, '') // uuids
      .replace(/0x[0-9a-f]+/g, '') // hex addresses
      .replace(/\d+/g, '') // any remaining numbers
      .replace(/[^a-z\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return createHash('sha256')
      .update(`${category}:${normalized}`)
      .digest('hex')
      .slice(0, 32);
  }

  async triage(input: TriageInput): Promise<TriageResult> {
    if (this.apiKey) {
      try {
        const result = await this.triageWithClaude(input);
        if (result) return result;
      } catch (err) {
        this.logger.warn(
          `Claude triage failed, falling back to heuristic: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
    return this.heuristicTriage(input);
  }

  private async triageWithClaude(
    input: TriageInput,
  ): Promise<TriageResult | null> {
    const payload = {
      model: this.model,
      max_tokens: 1024,
      system:
        'You are a senior engineer triaging in-app bug reports for a mobile/web ' +
        'social app. Respond ONLY with a single JSON object, no prose, matching: ' +
        '{"summary": string (<=200 chars), "probableCause": string (<=300 chars), ' +
        '"severity": "LOW"|"MEDIUM"|"HIGH"|"CRITICAL", "reproSteps": string[] (1-6 steps)}. ' +
        'CRITICAL = crashes, data loss, or payment/security failures. HIGH = a core ' +
        'flow is broken. MEDIUM = degraded but usable. LOW = cosmetic or minor.',
      messages: [
        {
          role: 'user',
          content: JSON.stringify({
            title: input.title,
            description: input.description,
            category: input.category,
            route: input.route ?? null,
            recentLogs: this.clip(input.logs, 4000),
            device: input.deviceInfo ?? null,
            app: input.appInfo ?? null,
          }),
        },
      ],
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    let res: Response;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.apiKey as string,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text =
      data.content?.find((c) => c.type === 'text')?.text?.trim() ?? '';
    const json = this.extractJson(text);
    if (!json) return null;

    return {
      summary: this.str(json.summary) || input.title,
      probableCause: this.str(json.probableCause) || 'Unknown',
      severity: this.coerceSeverity(json.severity),
      reproSteps: this.coerceSteps(json.reproSteps),
      aiGenerated: true,
    };
  }

  // --- deterministic fallback -------------------------------------------------

  private heuristicTriage(input: TriageInput): TriageResult {
    const text = `${input.title}\n${input.description}`.toLowerCase();
    const severity = this.heuristicSeverity(text, input.category);
    return {
      summary: input.title.slice(0, 200),
      probableCause:
        'Automated triage unavailable — needs manual review of attached logs and replay.',
      severity,
      reproSteps: [
        `Open ${input.route ?? 'the affected screen'}`,
        'Reproduce the action described by the reporter',
        'Observe the reported behaviour',
      ],
      aiGenerated: false,
    };
  }

  private heuristicSeverity(text: string, category: BugCategory): BugSeverity {
    const has = (...words: string[]) => words.some((w) => text.includes(w));
    if (
      has(
        'crash',
        'crashed',
        'data loss',
        'lost my',
        'cannot pay',
        "can't pay",
        'charged twice',
        'security',
        'leak',
        'hacked',
      ) ||
      (category === BugCategory.PAYMENTS && has('failed', 'error', 'declined'))
    ) {
      return BugSeverity.CRITICAL;
    }
    if (
      has(
        'broken',
        'cannot',
        "can't",
        'unable',
        'not working',
        "doesn't work",
        'fails',
        'stuck',
        'freeze',
        'frozen',
      ) ||
      category === BugCategory.PAYMENTS ||
      category === BugCategory.ACCOUNT
    ) {
      return BugSeverity.HIGH;
    }
    if (
      has('slow', 'lag', 'laggy', 'delay', 'glitch') ||
      category === BugCategory.PERFORMANCE ||
      category === BugCategory.CHAT ||
      category === BugCategory.NOTIFICATIONS
    ) {
      return BugSeverity.MEDIUM;
    }
    if (
      category === BugCategory.FEATURE_REQUEST ||
      category === BugCategory.UI_UX
    ) {
      return BugSeverity.LOW;
    }
    return BugSeverity.MEDIUM;
  }

  // --- helpers ----------------------------------------------------------------

  private clip(value: unknown, max: number): string {
    if (value == null) return '';
    const s = typeof value === 'string' ? value : JSON.stringify(value);
    return s.length > max ? `${s.slice(0, max)}…[truncated]` : s;
  }

  private extractJson(text: string): Record<string, unknown> | null {
    if (!text) return null;
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private str(v: unknown): string {
    return typeof v === 'string' ? v.trim().slice(0, 1000) : '';
  }

  private coerceSeverity(v: unknown): BugSeverity {
    const s = String(v).toUpperCase();
    return (Object.values(BugSeverity) as string[]).includes(s)
      ? (s as BugSeverity)
      : BugSeverity.MEDIUM;
  }

  private coerceSteps(v: unknown): string[] {
    if (!Array.isArray(v)) return [];
    return v
      .map((s) => (typeof s === 'string' ? s.trim() : ''))
      .filter(Boolean)
      .slice(0, 6);
  }
}
