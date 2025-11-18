import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { UserEvaluation, LEVEL_CONFIGURATIONS } from '../models/user-evaluation.model';
import firebase from 'firebase/compat/app';

@Injectable({
  providedIn: 'root'
})
export class UserEvaluationService {

  constructor(private firestore: AngularFirestore) {}

  // Crear o actualizar evaluación
  async saveEvaluation(evaluation: UserEvaluation): Promise<void> {
    // Calcular puntuación total y nivel
    const calculatedEvaluation = this.calculateEvaluationLevel(evaluation);
    
    if (evaluation.id) {
      // Actualizar evaluación existente
      await this.firestore.collection('user-evaluations').doc(evaluation.id).update(calculatedEvaluation);
    } else {
      // Crear nueva evaluación
      await this.firestore.collection('user-evaluations').add(calculatedEvaluation);
    }

    // NO actualizar el perfil del usuario - solo guardar la evaluación
    console.log(`Evaluación guardada para usuario ${evaluation.userName} por ${evaluation.evaluatedBy}`);
  }

  // MÉTODO DESACTIVADO - No se actualiza el perfil automáticamente
  // Actualizar perfil del usuario con nivel e impuesto
  /*
  private async updateUserProfile(userId: string, nivel: number, impuestoPorcentaje: number): Promise<void> {
    try {
      await this.firestore.collection('users').doc(userId).update({
        evaluationLevel: nivel,
        taxPercentage: impuestoPorcentaje,
        lastEvaluated: firebase.firestore.FieldValue.serverTimestamp()
      });
      console.log(`Perfil actualizado para usuario ${userId}: Nivel ${nivel}, Impuesto ${impuestoPorcentaje}%`);
    } catch (error) {
      console.error('Error actualizando perfil de usuario:', error);
    }
  }
  */

  // Obtener evaluación de un usuario
  getUserEvaluation(userId: string): Observable<UserEvaluation | undefined> {
    return this.firestore.collection('user-evaluations', ref => 
      ref.where('userId', '==', userId)
    ).valueChanges({ idField: 'id' }).pipe(
      map((evaluations: any[]) => {
        const typedEvaluations = evaluations as UserEvaluation[];
        return typedEvaluations.length > 0 ? typedEvaluations[typedEvaluations.length - 1] : undefined;
      })
    );
  }

  // Obtener todas las evaluaciones
  getAllEvaluations(): Observable<UserEvaluation[]> {
    return this.firestore.collection('user-evaluations', ref => 
      ref.orderBy('evaluatedAt', 'desc')
    ).valueChanges({ idField: 'id' }).pipe(
      map((evaluations: any[]) => evaluations as UserEvaluation[])
    );
  }

  // Calcular nivel y puntuación total
  calculateEvaluationLevel(evaluation: UserEvaluation): UserEvaluation {
    // Calcular puntuación total
    const cantoTotal = evaluation.canto.afinacion + evaluation.canto.rangoVocal + 
                      evaluation.canto.controlVocal + evaluation.canto.expresividad;
    
    const instrumentoTotal = evaluation.instrumento.tecnica + evaluation.instrumento.precision + 
                            evaluation.instrumento.creatividad + evaluation.instrumento.versatilidad;
    
    const compromisoTotal = evaluation.compromiso.asistenciaEnsayos + 
                           evaluation.compromiso.participacionEventos + 
                           evaluation.compromiso.colaboracion;
    
    const puntuacionTotal = cantoTotal + instrumentoTotal + compromisoTotal;
    
    // Determinar nivel basado en la puntuación
    let nivel = 6; // Por defecto el nivel más bajo
    let impuestoPorcentaje = 70; // Por defecto el impuesto más alto
    
    for (const config of LEVEL_CONFIGURATIONS) {
      if (puntuacionTotal >= config.puntuacionMin && puntuacionTotal <= config.puntuacionMax) {
        nivel = config.nivel;
        impuestoPorcentaje = config.impuestoPorcentaje;
        break;
      }
    }
    
    return {
      ...evaluation,
      puntuacionTotal,
      nivel,
      impuestoPorcentaje,
      evaluatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
  }

  // Obtener configuración de nivel
  getLevelConfiguration(nivel: number) {
    return LEVEL_CONFIGURATIONS.find(config => config.nivel === nivel);
  }

  // Calcular ganancia neta basada en el nivel
  calculateNetEarnings(grossAmount: number, userLevel: number): number {
    const config = this.getLevelConfiguration(userLevel);
    if (!config) return grossAmount;
    
    const taxAmount = grossAmount * (config.impuestoPorcentaje / 100);
    return grossAmount - taxAmount;
  }

  // Obtener estadísticas por nivel
  getLevelStatistics(): Observable<any> {
    return this.getAllEvaluations().pipe(
      map(evaluations => {
        const stats = LEVEL_CONFIGURATIONS.map(config => ({
          ...config,
          count: evaluations.filter(evaluation => evaluation.nivel === config.nivel).length,
          members: evaluations.filter(evaluation => evaluation.nivel === config.nivel)
        }));
        
        return {
          totalEvaluated: evaluations.length,
          levelBreakdown: stats
        };
      })
    );
  }

  // Eliminar evaluación
  async deleteEvaluation(evaluationId: string): Promise<void> {
    await this.firestore.collection('user-evaluations').doc(evaluationId).delete();
  }

  // Obtener nivel del usuario desde su perfil
  getUserLevelFromProfile(userId: string): Observable<{level: number, taxPercentage: number} | null> {
    return this.firestore.collection('users').doc(userId).valueChanges().pipe(
      map((userData: any) => {
        if (userData && userData.evaluationLevel && userData.taxPercentage !== undefined) {
          return {
            level: userData.evaluationLevel,
            taxPercentage: userData.taxPercentage
          };
        }
        return null;
      })
    );
  }

  // Obtener usuarios con sus niveles desde perfil
  getUsersWithLevels(): Observable<any[]> {
    return this.firestore.collection('users').valueChanges({ idField: 'uid' }).pipe(
      map((users: any[]) => {
        return users.map(user => ({
          ...user,
          displayLevel: user.evaluationLevel || 'Sin evaluar',
          displayTax: user.taxPercentage || 'N/A'
        })).sort((a, b) => (a.evaluationLevel || 99) - (b.evaluationLevel || 99));
      })
    );
  }
}