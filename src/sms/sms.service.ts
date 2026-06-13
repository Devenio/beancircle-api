import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const SMSIR_BASE = 'https://api.sms.ir/v1';

export interface SmsVerifyParameter {
  name: string;
  value: string;
}

interface SmsirResponse<T = unknown> {
  status: number;
  message: string;
  data: T;
}

interface SendVerifyData {
  messageId: number;
}

interface SendBulkData {
  packId: string;
  messageIds: number[];
  cost: number;
}

@Injectable()
export class SmsService implements OnModuleInit {
  private readonly logger = new Logger(SmsService.name);
  private apiKey: string | null = null;
  private lineNumber: number | null = null;
  private enabled = false;

  constructor(private config: ConfigService) {}

  onModuleInit() {
    const apiKey = this.config.get<string>('SMSIR_API_KEY');
    const lineNumber = this.config.get<string>('SMSIR_LINE_NUMBER');

    if (apiKey) {
      this.apiKey = apiKey;
      this.lineNumber = lineNumber ? Number(lineNumber) : null;
      this.enabled = true;
    } else {
      this.logger.warn(
        'SMSIR_API_KEY not configured — SMS sending disabled. Set SMSIR_API_KEY to enable.',
      );
    }
  }

  get isEnabled() {
    return this.enabled;
  }

  /**
   * Send a verification/OTP code via a pre-defined SMS.ir template.
   * The template must be created in the SMS.ir panel first.
   *
   * @param mobile  Recipient phone number (e.g. "09120000000")
   * @param templateId  Template ID from SMS.ir panel
   * @param parameters  Template variable bindings (e.g. [{ name: 'Code', value: '123456' }])
   */
  async sendVerifyCode(
    mobile: string,
    templateId: number,
    parameters: SmsVerifyParameter[],
  ): Promise<void> {
    if (!this.enabled) {
      this.logger.warn(`SMS disabled — skipping verify send to ${mobile}`);
      return;
    }

    const res = await this.post<SendVerifyData>('/send/verify', {
      mobile,
      templateId,
      parameters,
    });

    this.logger.log(
      `Verify SMS sent to ${mobile} — messageId: ${res.data.messageId}`,
    );
  }

  /**
   * Send the same message to one or more recipients.
   *
   * @param messageText  Message body
   * @param mobiles      Array of recipient phone numbers
   * @param lineNumber   Override the default line number
   */
  async sendBulk(
    messageText: string,
    mobiles: string[],
    lineNumber?: number,
  ): Promise<SendBulkData> {
    if (!this.enabled) {
      this.logger.warn(
        `SMS disabled — skipping bulk send to ${mobiles.length} number(s)`,
      );
      return { packId: '', messageIds: [], cost: 0 };
    }

    const line = lineNumber ?? this.lineNumber;
    if (!line) {
      throw new Error('No SMS line number configured. Set SMSIR_LINE_NUMBER.');
    }

    const res = await this.post<SendBulkData>('/send/bulk', {
      lineNumber: line,
      messageText,
      mobiles,
    });

    this.logger.log(
      `Bulk SMS sent — packId: ${res.data.packId}, recipients: ${mobiles.length}`,
    );
    return res.data;
  }

  private async post<T>(
    path: string,
    body: unknown,
  ): Promise<SmsirResponse<T>> {
    const response = await fetch(`${SMSIR_BASE}${path}`, {
      method: 'POST',
      headers: {
        'X-API-KEY': this.apiKey!,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });

    const json = (await response.json()) as SmsirResponse<T>;

    if (!response.ok || json.status !== 1) {
      throw new Error(
        `SMS.ir error [${response.status}]: ${json.message ?? 'unknown error'}`,
      );
    }

    return json;
  }
}
