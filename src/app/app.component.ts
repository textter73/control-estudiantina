import { Component, OnInit } from '@angular/core';
import { PwaService } from './services/pwa.service';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import firebase from 'firebase/compat/app';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'Control Estudiantina';
  
  constructor(
    private pwaService: PwaService,
    private afAuth: AngularFireAuth
  ) {
    // Inicializar servicio PWA
  }
  
  async ngOnInit() {
    // Asegurar persistencia LOCAL al iniciar la app
    // Esto garantiza que la sesión se mantenga incluso después de cerrar la PWA
    try {
      await this.afAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      console.log('✅ Persistencia de sesión configurada: LOCAL (permanente)');
      
      // Verificar estado de autenticación
      this.afAuth.authState.subscribe(user => {
        if (user) {
          console.log('✅ Usuario autenticado:', user.email);
          console.log('🔐 La sesión se mantendrá activa permanentemente');
        } else {
          console.log('ℹ️ No hay usuario autenticado');
        }
      });
    } catch (error) {
      console.error('❌ Error configurando persistencia:', error);
    }
  }
}