import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QrCodeKind } from '@prisma/client';
import { randomBytes } from 'crypto';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';

@Injectable()
export class QrService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private audit: AuditService,
  ) {}

  private newCode() {
    return `QR-${randomBytes(5).toString('hex').toUpperCase()}`;
  }

  async menuUrl(cafeId: string, code?: string, locale = 'en') {
    const menu = await this.prisma.cafeMenu.findUnique({ where: { cafeId } });
    if (!menu) {
      throw new BadRequestException('Create and save your menu first');
    }
    const front = this.config.get('FRONTEND_URL') ?? 'http://localhost:3000';
    const base = `${front}/${locale}/m/${menu.slug}`;
    return code ? `${base}?t=${encodeURIComponent(code)}` : base;
  }

  // ---------- Tables ----------

  listTables(cafeId: string) {
    return this.prisma.cafeTable.findMany({
      where: { cafeId },
      orderBy: { order: 'asc' },
      include: {
        qrCode: { select: { id: true, code: true, scanCount: true } },
      },
    });
  }

  async createTable(actorId: string, cafeId: string, name: string) {
    const count = await this.prisma.cafeTable.count({ where: { cafeId } });
    const table = await this.prisma.cafeTable.create({
      data: {
        cafeId,
        name,
        order: count,
        qrCode: {
          create: {
            cafeId,
            kind: QrCodeKind.TABLE,
            code: this.newCode(),
            label: name,
          },
        },
      },
      include: {
        qrCode: { select: { id: true, code: true, scanCount: true } },
      },
    });
    await this.audit.log({
      cafeId,
      actorId,
      action: 'table.created',
      entity: 'table',
      entityId: table.id,
      meta: { name },
    });
    return table;
  }

  async renameTable(
    actorId: string,
    cafeId: string,
    tableId: string,
    name: string,
  ) {
    const table = await this.prisma.cafeTable.findUnique({
      where: { id: tableId },
    });
    if (!table || table.cafeId !== cafeId) {
      throw new NotFoundException('Table not found');
    }
    const updated = await this.prisma.cafeTable.update({
      where: { id: tableId },
      data: { name },
      include: {
        qrCode: { select: { id: true, code: true, scanCount: true } },
      },
    });
    await this.prisma.qrCode.updateMany({
      where: { tableId },
      data: { label: name },
    });
    await this.audit.log({
      cafeId,
      actorId,
      action: 'table.renamed',
      entity: 'table',
      entityId: tableId,
      meta: { name },
    });
    return updated;
  }

  async deleteTable(actorId: string, cafeId: string, tableId: string) {
    const table = await this.prisma.cafeTable.findUnique({
      where: { id: tableId },
    });
    if (!table || table.cafeId !== cafeId) {
      throw new NotFoundException('Table not found');
    }
    await this.prisma.cafeTable.delete({ where: { id: tableId } });
    await this.audit.log({
      cafeId,
      actorId,
      action: 'table.deleted',
      entity: 'table',
      entityId: tableId,
      meta: { name: table.name },
    });
    return { deleted: true };
  }

  async reorderTables(cafeId: string, ids: string[]) {
    await this.prisma.$transaction(
      ids.map((id, i) =>
        this.prisma.cafeTable.updateMany({
          where: { id, cafeId },
          data: { order: i },
        }),
      ),
    );
    return this.listTables(cafeId);
  }

  // ---------- QR codes ----------

  listQrCodes(cafeId: string) {
    return this.prisma.qrCode.findMany({
      where: { cafeId },
      orderBy: { createdAt: 'asc' },
      include: { table: { select: { id: true, name: true } } },
    });
  }

  async createQr(
    actorId: string,
    cafeId: string,
    kind: QrCodeKind,
    label?: string,
    eventId?: string,
  ) {
    if (kind === QrCodeKind.TABLE) {
      throw new BadRequestException('Table QR codes are created with tables');
    }
    if (kind === QrCodeKind.EVENT && !eventId) {
      throw new BadRequestException('eventId is required for event QR codes');
    }
    const qr = await this.prisma.qrCode.create({
      data: {
        cafeId,
        kind,
        code: this.newCode(),
        label: label ?? null,
        eventId: eventId ?? null,
      },
    });
    await this.audit.log({
      cafeId,
      actorId,
      action: 'qr.created',
      entity: 'qrCode',
      entityId: qr.id,
      meta: { kind, label },
    });
    return qr;
  }

  async deleteQr(actorId: string, cafeId: string, qrId: string) {
    const qr = await this.prisma.qrCode.findUnique({ where: { id: qrId } });
    if (!qr || qr.cafeId !== cafeId) {
      throw new NotFoundException('QR code not found');
    }
    if (qr.kind === QrCodeKind.TABLE) {
      throw new BadRequestException('Delete the table to remove its QR code');
    }
    await this.prisma.qrCode.delete({ where: { id: qrId } });
    await this.audit.log({
      cafeId,
      actorId,
      action: 'qr.deleted',
      entity: 'qrCode',
      entityId: qrId,
    });
    return { deleted: true };
  }

  async getQrWithUrl(cafeId: string, qrId: string, locale = 'en') {
    const qr = await this.prisma.qrCode.findUnique({
      where: { id: qrId },
      include: { table: { select: { id: true, name: true } } },
    });
    if (!qr || qr.cafeId !== cafeId) {
      throw new NotFoundException('QR code not found');
    }
    const url = await this.menuUrl(cafeId, qr.code, locale);
    return { qr, url };
  }

  async renderPng(cafeId: string, qrId: string, locale = 'en') {
    const { url } = await this.getQrWithUrl(cafeId, qrId, locale);
    const accent = await this.accentColor(cafeId);
    return QRCode.toBuffer(url, {
      type: 'png',
      margin: 2,
      width: 1024,
      color: { dark: accent, light: '#FFFFFF' },
    });
  }

  async renderSvg(cafeId: string, qrId: string, locale = 'en') {
    const { url } = await this.getQrWithUrl(cafeId, qrId, locale);
    const accent = await this.accentColor(cafeId);
    return QRCode.toString(url, {
      type: 'svg',
      margin: 2,
      color: { dark: accent, light: '#FFFFFF' },
    });
  }

  async renderDataUrl(cafeId: string, qrId: string, locale = 'en') {
    const { qr, url } = await this.getQrWithUrl(cafeId, qrId, locale);
    const accent = await this.accentColor(cafeId);
    const qrDataUrl = await QRCode.toDataURL(url, {
      margin: 2,
      width: 512,
      color: { dark: accent, light: '#FFFFFF' },
    });
    return { qr, url, qrDataUrl };
  }

  private async accentColor(cafeId: string) {
    const menu = await this.prisma.cafeMenu.findUnique({
      where: { cafeId },
      select: { accentColor: true },
    });
    return menu?.accentColor ?? '#2C1810';
  }
}
