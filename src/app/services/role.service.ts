import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  profiles: string[];
  createdAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class RoleService {

  constructor(
    private afAuth: AngularFireAuth,
    private firestore: AngularFirestore
  ) { }

  /**
   * Obtiene los perfiles del usuario actual
   */
  getCurrentUserProfiles(): Observable<string[]> {
    return this.afAuth.authState.pipe(
      switchMap(user => {
        if (!user) {
          return of([]);
        }
        
        return this.firestore.collection('users').doc(user.uid).get().pipe(
          map(doc => {
            const userData = doc.data() as UserProfile;
            return userData?.profiles || [];
          })
        );
      })
    );
  }

  /**
   * Verifica si el usuario actual tiene un perfil específico
   */
  hasProfile(profileName: string): Observable<boolean> {
    return this.getCurrentUserProfiles().pipe(
      map(profiles => profiles.includes(profileName))
    );
  }

  /**
   * Verifica si el usuario puede editar canciones
   */
  canEditSongs(): Observable<boolean> {
    return this.getCurrentUserProfiles().pipe(
      map(profiles => 
        profiles.includes('administrador') || 
        profiles.includes('editor-canciones')
      )
    );
  }

  /**
   * Verifica si el usuario es administrador
   */
  isAdmin(): Observable<boolean> {
    return this.hasProfile('administrador');
  }

  /**
   * Verifica si el usuario puede acceder al panel de administración
   */
  canAccessAdmin(): Observable<boolean> {
    return this.isAdmin();
  }

  /**
   * Obtiene la información completa del usuario actual
   */
  getCurrentUserProfile(): Observable<UserProfile | null> {
    return this.afAuth.authState.pipe(
      switchMap(user => {
        if (!user) {
          return of(null);
        }
        
        return this.firestore.collection('users').doc(user.uid).get().pipe(
          map(doc => {
            const userData = doc.data() as UserProfile;
            return userData || null;
          })
        );
      })
    );
  }

  /**
   * Lista de perfiles disponibles en el sistema
   */
  getAvailableProfiles(): string[] {
    return [
      'integrante',
      'editor-canciones',
      'administrador'
    ];
  }

  /**
   * Descripciones de los perfiles
   */
  getProfileDescriptions(): { [key: string]: string } {
    return {
      'integrante': 'Acceso básico - puede ver contenido',
      'editor-canciones': 'Puede editar letras e instrumentación de canciones',
      'administrador': 'Acceso completo al sistema'
    };
  }
}