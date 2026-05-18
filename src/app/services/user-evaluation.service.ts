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

  // Obtener evaluación de un usuario (última evaluación)
  getUserEvaluation(userId: string): Observable<UserEvaluation | undefined> {
    return this.firestore.collection('user-evaluations', ref => 
      ref.where('userId', '==', userId)
    ).valueChanges({ idField: 'id' }).pipe(
      map((evaluations: any[]) => {
        const typedEvaluations = evaluations as UserEvaluation[];
        
        if (typedEvaluations.length === 0) {
          return undefined;
        }
        
        // Ordenar por fecha en el cliente (descendente - más reciente primero)
        const sortedEvaluations = typedEvaluations.sort((a, b) => {
          const dateA = a.evaluatedAt?.toDate ? a.evaluatedAt.toDate() : new Date(a.evaluatedAt);
          const dateB = b.evaluatedAt?.toDate ? b.evaluatedAt.toDate() : new Date(b.evaluatedAt);
          return dateB.getTime() - dateA.getTime();
        });
        
        return sortedEvaluations[0];
      })
    );
  }

  // Obtener evaluación de un usuario por nombre (método alternativo)
  getUserEvaluationByName(userName: string): Observable<UserEvaluation | undefined> {
    return this.firestore.collection('user-evaluations', ref => 
      ref.where('userName', '==', userName)
    ).valueChanges({ idField: 'id' }).pipe(
      map((evaluations: any[]) => {
        const typedEvaluations = evaluations as UserEvaluation[];
        
        if (typedEvaluations.length === 0) {
          return undefined;
        }
        
        // Ordenar por fecha en el cliente (descendente - más reciente primero)
        const sortedEvaluations = typedEvaluations.sort((a, b) => {
          const dateA = a.evaluatedAt?.toDate ? a.evaluatedAt.toDate() : new Date(a.evaluatedAt);
          const dateB = b.evaluatedAt?.toDate ? b.evaluatedAt.toDate() : new Date(b.evaluatedAt);
          return dateB.getTime() - dateA.getTime();
        });
        
        return sortedEvaluations[0];
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
    
    const compromisoTotal = evaluation.compromiso.ensayos + 
                           evaluation.compromiso.eventos + 
                           evaluation.compromiso.misas;
    
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

  // Función de utilidad para corregir userId en evaluaciones existentes
  async fixUserIdInEvaluations(): Promise<{ updated: number, notFound: number, total: number }> {
    try {
      // Obtener todos los usuarios
      const usersSnapshot = await this.firestore.collection('users').get().toPromise();
      const users = usersSnapshot?.docs.map(doc => {
        const data = doc.data() as any;
        return {
          uid: doc.id,
          ...data
        };
      }) || [];

      // Obtener todas las evaluaciones
      const evaluationsSnapshot = await this.firestore.collection('user-evaluations').get().toPromise();
      const evaluations = evaluationsSnapshot?.docs || [];

      let updated = 0;
      let notFound = 0;

      for (const evalDoc of evaluations) {
        const evalData = evalDoc.data() as any;
        const userName = evalData.userName;

        // Función helper para normalizar nombres (quitar espacios extras, poner en minúsculas)
        const normalize = (str: string) => str?.trim().toLowerCase() || '';

        // Buscar el usuario correspondiente - primero exacto, luego normalizado
        let user = users.find(u => u['name'] === userName);
        
        if (!user) {
          // Intentar búsqueda normalizada
          user = users.find(u => normalize(u['name']) === normalize(userName));
        }
        
        if (!user) {
          // Intentar por nickname
          user = users.find(u => normalize(u['nickname']) === normalize(userName));
        }

        if (user) {
          if (evalData.userId !== user.uid) {
            await this.firestore.collection('user-evaluations').doc(evalDoc.id).update({
              userId: user.uid
            });
            updated++;
          }
        } else {
          notFound++;
        }
      }

      return {
        updated,
        notFound,
        total: evaluations.length
      };
    } catch (error) {
      throw error;
    }
  }
}