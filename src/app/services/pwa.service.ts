import { Injectable } from '@angular/core';
import { SwUpdate, UpdateAvailableEvent } from '@angular/service-worker';

@Injectable({
  providedIn: 'root'
})
export class PwaService {
  promptEvent: any;

  constructor(private swUpdate: SwUpdate) {
    // Detectar cuando hay una nueva versión disponible (solo en producción)
    if (this.swUpdate && this.swUpdate.isEnabled) {
      this.swUpdate.available.subscribe((event: UpdateAvailableEvent) => {
        if (confirm('Nueva versión disponible. ¿Deseas actualizar?')) {
          window.location.reload();
        }
      });
    }

    // Detectar el evento de instalación de la PWA
    window.addEventListener('beforeinstallprompt', (event: any) => {
      event.preventDefault();
      this.promptEvent = event;
    });
  }

  installPwa(): void {
    if (this.promptEvent) {
      this.promptEvent.prompt();
      this.promptEvent.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('Usuario aceptó instalar la PWA');
        }
        this.promptEvent = null;
      });
    }
  }

  checkForUpdates(): void {
    if (this.swUpdate && this.swUpdate.isEnabled) {
      this.swUpdate.checkForUpdate().then(() => {
        console.log('Verificando actualizaciones...');
      });
    }
  }
}
