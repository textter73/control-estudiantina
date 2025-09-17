import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  email: string = '';
  pin1: string = '';
  pin2: string = '';
  pin3: string = '';
  pin4: string = '';
  pin5: string = '';
  pin6: string = '';
  loading: boolean = false;

  get password(): string {
    return this.pin1 + this.pin2 + this.pin3 + this.pin4 + this.pin5 + this.pin6;
  }

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  async onSubmit() {
    if (!this.email || this.password.length !== 6) {
      Swal.fire({
        icon: 'warning',
        title: 'Campos incompletos',
        text: 'Email y PIN de 6 dígitos son obligatorios'
      });
      return;
    }

    this.loading = true;

    const result = await this.authService.login(this.email, this.password);
    
    if (result.success) {
      Swal.fire({
        icon: 'success',
        title: '¡Bienvenido!',
        text: 'Inicio de sesión exitoso',
        timer: 1500,
        showConfirmButton: false
      }).then(() => {
        this.router.navigate(['/dashboard']);
      });
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Error de autenticación',
        text: result.error
      });
    }
    
    this.loading = false;
  }

  onPinInput(event: any, position: number) {
    let value = event.target.value;
    
    // Limitar a un solo dígito
    if (value.length > 1) {
      value = value.slice(-1);
      event.target.value = value;
    }
    
    // Actualizar el modelo
    switch(position) {
      case 1: this.pin1 = value; break;
      case 2: this.pin2 = value; break;
      case 3: this.pin3 = value; break;
      case 4: this.pin4 = value; break;
      case 5: this.pin5 = value; break;
      case 6: this.pin6 = value; break;
    }
    
    if (value && /^[0-9]$/.test(value)) {
      if (position < 6) {
        const nextInput = document.querySelector(`input[name="pin${position + 1}"]`) as HTMLInputElement;
        if (nextInput) {
          nextInput.focus();
        }
      } else if (position === 6) {
        setTimeout(() => {
          if (this.password.length === 6) {
            this.onSubmit();
          }
        }, 100);
      }
    }
  }

  onPinKeydown(event: any, position: number) {
    if (event.key === 'Backspace' && !event.target.value && position > 1) {
      const prevInput = document.querySelector(`input[name="pin${position - 1}"]`) as HTMLInputElement;
      if (prevInput) {
        prevInput.focus();
      }
    }
  }
}