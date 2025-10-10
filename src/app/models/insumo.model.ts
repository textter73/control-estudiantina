export interface Insumo {
  id?: string;
  nombre: string;
  categoria: CategoriaInsumo;
  descripcion?: string;
  cantidadDisponible: number;
  cantidadMinima: number;
  costoUnitario: number;
  proveedor?: string;
  fechaCreacion: Date;
  fechaActualizacion: Date;
  activo: boolean;
  imagen?: string;
}

export enum CategoriaInsumo {
  CUERDAS = 'cuerdas',
  UNAS = 'uñas',
  PLUMILLAS = 'plumillas',
  TALIF = 'talif',
  CAPOTRASTOS = 'capotrastos',
  AFINADORES = 'afinadores',
  CORREAS = 'correas',
  FUNDAS = 'fundas',
  ACCESORIOS = 'accesorios',
  MANTENIMIENTO = 'mantenimiento',
  OTROS = 'otros'
}

export interface SolicitudInsumo {
  id?: string;
  usuarioId: string;
  nombreUsuario: string;
  insumoId: string;
  nombreInsumo: string;
  cantidadSolicitada: number;
  fechaSolicitud: Date;
  estado: EstadoSolicitud;
  observaciones?: string;
  fechaRespuesta?: Date;
  comentarioAdmin?: string;
  costoTotal: number;
}

export enum EstadoSolicitud {
  PENDIENTE = 'pendiente',
  APROBADA = 'aprobada',
  RECHAZADA = 'rechazada',
  ENTREGADA = 'entregada'
}

export interface MovimientoInventario {
  id?: string;
  insumoId: string;
  nombreInsumo: string;
  tipo: TipoMovimiento;
  cantidad: number;
  cantidadAnterior: number;
  cantidadNueva: number;
  motivo: string;
  usuarioId: string;
  nombreUsuario: string;
  fecha: Date;
  solicitudId?: string;
}

export enum TipoMovimiento {
  ENTRADA = 'entrada',
  SALIDA = 'salida',
  AJUSTE = 'ajuste'
}