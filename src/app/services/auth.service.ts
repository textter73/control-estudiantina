import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import firebase from 'firebase/compat/app';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  constructor(
    public afAuth: AngularFireAuth, // Cambiado a público
    public firestore: AngularFirestore // Cambiado a público
  ) {
    // Configurar persistencia LOCAL para mantener la sesión permanentemente
    this.setPersistence();
  }

  /**
   * Configura la persistencia de sesión como LOCAL (permanente)
   * La sesión se mantendrá activa incluso después de cerrar el navegador
   */
  private async setPersistence() {
    try {
      await this.afAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      console.log('Persistencia de sesión configurada como LOCAL (permanente)');
    } catch (error) {
      console.error('Error al configurar persistencia:', error);
    }
  }

  async register(name: string, email: string, password: string) {
    try {
      // Asegurar persistencia LOCAL antes de crear la cuenta
      await this.afAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      
      const result = await this.afAuth.createUserWithEmailAndPassword(email, password);
      
      if (result.user) {
        await this.firestore.collection('users').doc(result.user.uid).set({
          name: name,
          email: email,
          profiles: ['integrante'],
          createdAt: new Date(),
          uid: result.user.uid
        });
        
        return { success: true, user: result.user };
      }
      return { success: false, error: 'Error al crear usuario' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async login(email: string, password: string) {
    try {
      // Asegurar persistencia LOCAL antes de iniciar sesión
      await this.afAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      
      const result = await this.afAuth.signInWithEmailAndPassword(email, password);
      console.log('Sesión iniciada con persistencia LOCAL - se mantendrá activa permanentemente');
      return { success: true, user: result.user };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async addProfile(userId: string, newProfile: string) {
    try {
      const userDoc = await this.firestore.collection('users').doc(userId).get().toPromise();
      const userData = userDoc?.data() as any;
      
      if (userData && !userData.profiles.includes(newProfile)) {
        const updatedProfiles = [...userData.profiles, newProfile];
        await this.firestore.collection('users').doc(userId).update({
          profiles: updatedProfiles
        });
        return { success: true };
      }
      return { success: false, error: 'Perfil ya existe' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async removeProfile(userId: string, profileToRemove: string) {
    try {
      const userDoc = await this.firestore.collection('users').doc(userId).get().toPromise();
      const userData = userDoc?.data() as any;
      
      if (userData && userData.profiles.includes(profileToRemove)) {
        const updatedProfiles = userData.profiles.filter((profile: string) => profile !== profileToRemove);
        await this.firestore.collection('users').doc(userId).update({
          profiles: updatedProfiles
        });
        return { success: true };
      }
      return { success: false, error: 'Perfil no encontrado' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  getAllUsers() {
    return this.firestore.collection('users').valueChanges({ idField: 'uid' });
  }

  // Obtener solo usuarios activos (no desactivados)
  getActiveUsers() {
    return this.firestore.collection('users', ref => ref.where('deleted', '!=', true)).valueChanges({ idField: 'uid' });
  }

  // Obtener usuario actual autenticado
  getCurrentUser() {
    return this.afAuth.authState;
  }

  // Obtener datos del usuario actual desde Firestore
  async getCurrentUserData() {
    const user = await this.afAuth.currentUser;
    if (user) {
      const userDoc = await this.firestore.collection('users').doc(user.uid).get().toPromise();
      return userDoc?.data();
    }
    return null;
  }

}