import {
  Injectable,
  OnModuleInit,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private supabase: SupabaseClient;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const url = this.config.get<string>('supabase.url');
    const key = this.config.get<string>('supabase.serviceRoleKey');

    if (!url || !key) {
      throw new Error(
        'SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridos en las variables de entorno',
      );
    }

    this.supabase = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    console.log('✅ Cliente de Supabase Storage inicializado');
  }

  async uploadFile(
    bucket: string,
    path: string,
    fileBuffer: Buffer,
    contentType: string,
  ): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(bucket)
      .upload(path, fileBuffer, {
        contentType,
        upsert: true,
      });

    if (error) {
      throw new InternalServerErrorException(
        `Error al subir archivo a Storage: ${error.message}`,
      );
    }

    return data.path;
  }

  async deleteFile(bucket: string, path: string): Promise<void> {
    const { error } = await this.supabase.storage
      .from(bucket)
      .remove([path]);

    if (error) {
      if (error.message?.toLowerCase().includes('not found')) {
        throw new NotFoundException('Archivo no encontrado en Storage');
      }
      throw new InternalServerErrorException(
        `Error al eliminar archivo de Storage: ${error.message}`,
      );
    }
  }

  async createSignedUrl(
    bucket: string,
    path: string,
  ): Promise<{ signedUrl: string; expiresAt: number }> {
    const expiry = this.config.get<number>('supabase.signedUrlExpiry') ?? 300;

    const { data, error } = await this.supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiry);

    if (error || !data) {
      if (error?.message?.toLowerCase().includes('not found')) {
        throw new NotFoundException('Archivo no encontrado en Storage');
      }
      throw new InternalServerErrorException(
        `Error al generar URL firmada: ${error?.message}`,
      );
    }

    return {
      signedUrl: data.signedUrl,
      expiresAt: Math.floor(Date.now() / 1000) + expiry,
    };
  }

  buildClienteDocumentPath(
    empresaId: string,
    clienteId: string,
    tipo: 'cedula-frontal' | 'cedula-trasera',
  ): string {
    const sanitizedEmpresa = empresaId.replace(/[^a-f0-9-]/gi, '');
    const sanitizedCliente = clienteId.replace(/[^a-f0-9-]/gi, '');

    if (!sanitizedEmpresa || !sanitizedCliente) {
      throw new BadRequestException('empresaId y clienteId son requeridos');
    }

    return `empresas/${sanitizedEmpresa}/clientes/${sanitizedCliente}/${tipo}.jpg`;
  }
}
