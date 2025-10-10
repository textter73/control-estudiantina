import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { Insumo, SolicitudInsumo, MovimientoInventario, EstadoSolicitud, TipoMovimiento } from '../models/insumo.model';

@Injectable({
  providedIn: 'root'
})
export class InsumoService {

  constructor(private firestore: AngularFirestore) { }

  // Método helper para convertir Firebase Timestamps a Date
  private convertTimestamps(obj: any): any {
    if (!obj) return obj;
    
    const converted = { ...obj };
    
    // Convertir fechas específicas
    if (converted.fechaCreacion && converted.fechaCreacion.toDate) {
      converted.fechaCreacion = converted.fechaCreacion.toDate();
    }
    if (converted.fechaActualizacion && converted.fechaActualizacion.toDate) {
      converted.fechaActualizacion = converted.fechaActualizacion.toDate();
    }
    if (converted.fechaSolicitud && converted.fechaSolicitud.toDate) {
      converted.fechaSolicitud = converted.fechaSolicitud.toDate();
    }
    if (converted.fechaRespuesta && converted.fechaRespuesta.toDate) {
      converted.fechaRespuesta = converted.fechaRespuesta.toDate();
    }
    if (converted.fecha && converted.fecha.toDate) {
      converted.fecha = converted.fecha.toDate();
    }
    
    return converted;
  }

  // === GESTIÓN DE INSUMOS ===
  
  getInsumos(): Observable<Insumo[]> {
    return this.firestore.collection<Insumo>('insumos').snapshotChanges().pipe(
      map(actions => actions.map(a => {
        const data = a.payload.doc.data() as Insumo;
        const id = a.payload.doc.id;
        return this.convertTimestamps({ id, ...data });
      }).filter(insumo => insumo.activo).sort((a, b) => a.nombre.localeCompare(b.nombre)))
    );
  }

  getInsumo(id: string): Observable<Insumo | undefined> {
    return this.firestore.doc<Insumo>(`insumos/${id}`).valueChanges().pipe(
      map(data => data ? { id, ...data } : undefined)
    );
  }

  addInsumo(insumo: Insumo): Promise<any> {
    insumo.fechaCreacion = new Date();
    insumo.fechaActualizacion = new Date();
    return this.firestore.collection('insumos').add(insumo);
  }

  updateInsumo(id: string, insumo: Partial<Insumo>): Promise<void> {
    insumo.fechaActualizacion = new Date();
    return this.firestore.doc(`insumos/${id}`).update(insumo);
  }

  deleteInsumo(id: string): Promise<void> {
    return this.firestore.doc(`insumos/${id}`).update({ activo: false });
  }

  // === GESTIÓN DE SOLICITUDES ===

  getSolicitudes(): Observable<SolicitudInsumo[]> {
    return this.firestore.collection<SolicitudInsumo>('solicitudesInsumo').snapshotChanges().pipe(
      map(actions => actions.map(a => {
        const data = a.payload.doc.data() as SolicitudInsumo;
        const id = a.payload.doc.id;
        return this.convertTimestamps({ id, ...data });
      }).sort((a, b) => new Date(b.fechaSolicitud).getTime() - new Date(a.fechaSolicitud).getTime()))
    );
  }

  getSolicitudesByUsuario(usuarioId: string): Observable<SolicitudInsumo[]> {
    return this.firestore.collection<SolicitudInsumo>('solicitudesInsumo').snapshotChanges().pipe(
      map(actions => actions.map(a => {
        const data = a.payload.doc.data() as SolicitudInsumo;
        const id = a.payload.doc.id;
        return this.convertTimestamps({ id, ...data });
      }).filter(solicitud => solicitud.usuarioId === usuarioId)
        .sort((a, b) => new Date(b.fechaSolicitud).getTime() - new Date(a.fechaSolicitud).getTime()))
    );
  }

  addSolicitud(solicitud: SolicitudInsumo): Promise<any> {
    solicitud.fechaSolicitud = new Date();
    solicitud.estado = EstadoSolicitud.PENDIENTE;
    return this.firestore.collection('solicitudesInsumo').add(solicitud);
  }

  updateSolicitud(id: string, solicitud: Partial<SolicitudInsumo>): Promise<void> {
    if (solicitud.estado && solicitud.estado !== EstadoSolicitud.PENDIENTE) {
      solicitud.fechaRespuesta = new Date();
    }
    return this.firestore.doc(`solicitudesInsumo/${id}`).update(solicitud);
  }

  // === GESTIÓN DE INVENTARIO ===

  registrarMovimiento(movimiento: MovimientoInventario): Promise<any> {
    movimiento.fecha = new Date();
    return this.firestore.collection('movimientosInventario').add(movimiento);
  }

  getMovimientos(): Observable<MovimientoInventario[]> {
    return this.firestore.collection<MovimientoInventario>('movimientosInventario').snapshotChanges().pipe(
      map(actions => actions.map(a => {
        const data = a.payload.doc.data() as MovimientoInventario;
        const id = a.payload.doc.id;
        return this.convertTimestamps({ id, ...data });
      }).sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()).slice(0, 100))
    );
  }

  getMovimientosByInsumo(insumoId: string): Observable<MovimientoInventario[]> {
    return this.firestore.collection<MovimientoInventario>('movimientosInventario').snapshotChanges().pipe(
      map(actions => actions.map(a => {
        const data = a.payload.doc.data() as MovimientoInventario;
        const id = a.payload.doc.id;
        return this.convertTimestamps({ id, ...data });
      }).filter(movimiento => movimiento.insumoId === insumoId)
        .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()))
    );
  }

  // === OPERACIONES COMBINADAS ===

  async aprobarSolicitud(solicitudId: string, solicitud: SolicitudInsumo, comentarioAdmin?: string): Promise<void> {
    try {
      // Actualizar la solicitud
      await this.updateSolicitud(solicitudId, {
        estado: EstadoSolicitud.APROBADA,
        comentarioAdmin: comentarioAdmin
      });

      // Obtener el insumo actual
      const insumoDoc = await this.firestore.doc(`insumos/${solicitud.insumoId}`).get().toPromise();
      if (insumoDoc && insumoDoc.exists) {
        const insumo = insumoDoc.data() as Insumo;
        const nuevaCantidad = insumo.cantidadDisponible - solicitud.cantidadSolicitada;

        // Actualizar el inventario
        await this.updateInsumo(solicitud.insumoId, {
          cantidadDisponible: nuevaCantidad
        });

        // Registrar el movimiento
        const movimiento: MovimientoInventario = {
          insumoId: solicitud.insumoId,
          nombreInsumo: solicitud.nombreInsumo,
          tipo: TipoMovimiento.SALIDA,
          cantidad: solicitud.cantidadSolicitada,
          cantidadAnterior: insumo.cantidadDisponible,
          cantidadNueva: nuevaCantidad,
          motivo: `Solicitud aprobada - ${solicitud.nombreUsuario}`,
          usuarioId: solicitud.usuarioId,
          nombreUsuario: solicitud.nombreUsuario,
          fecha: new Date(),
          solicitudId: solicitudId
        };

        await this.registrarMovimiento(movimiento);
      }
    } catch (error) {
      console.error('Error al aprobar solicitud:', error);
      throw error;
    }
  }

  async rechazarSolicitud(solicitudId: string, comentarioAdmin?: string): Promise<void> {
    return this.updateSolicitud(solicitudId, {
      estado: EstadoSolicitud.RECHAZADA,
      comentarioAdmin: comentarioAdmin
    });
  }

  async entregarSolicitud(solicitudId: string): Promise<void> {
    return this.updateSolicitud(solicitudId, {
      estado: EstadoSolicitud.ENTREGADA
    });
  }

  async ajustarInventario(insumoId: string, nuevaCantidad: number, motivo: string, usuarioId: string, nombreUsuario: string): Promise<void> {
    try {
      // Obtener el insumo actual
      const insumoDoc = await this.firestore.doc(`insumos/${insumoId}`).get().toPromise();
      if (insumoDoc && insumoDoc.exists) {
        const insumo = insumoDoc.data() as Insumo;
        
        // Actualizar el inventario
        await this.updateInsumo(insumoId, {
          cantidadDisponible: nuevaCantidad
        });

        // Registrar el movimiento
        const movimiento: MovimientoInventario = {
          insumoId: insumoId,
          nombreInsumo: insumo.nombre,
          tipo: TipoMovimiento.AJUSTE,
          cantidad: Math.abs(nuevaCantidad - insumo.cantidadDisponible),
          cantidadAnterior: insumo.cantidadDisponible,
          cantidadNueva: nuevaCantidad,
          motivo: motivo,
          usuarioId: usuarioId,
          nombreUsuario: nombreUsuario,
          fecha: new Date()
        };

        await this.registrarMovimiento(movimiento);
      }
    } catch (error) {
      console.error('Error al ajustar inventario:', error);
      throw error;
    }
  }
}