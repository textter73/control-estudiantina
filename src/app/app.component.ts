import { Component } from '@angular/core';
import { PwaService } from './services/pwa.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'Control Estudiantina';
  
  constructor(private pwaService: PwaService) {
    // Inicializar servicio PWA
  }
}