import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  constructor(
    public afAuth: AngularFireAuth, // Cambiado a público
    public firestore: AngularFirestore // Cambiado a público
  ) { }

  async register(name: string, email: string, password: string) {
    try {
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
      const result = await this.afAuth.signInWithEmailAndPassword(email, password);
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
    return this.firestore.collection('users').valueChanges();
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