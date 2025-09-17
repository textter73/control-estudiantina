import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent {
  name: string = '';
  email: string = '';
  pin1: string = '';
  pin2: string = '';
  pin3: string = '';
  pin4: string = '';
  pin5: string = '';
  pin6: string = '';
  loading: boolean = false;
  errorMessage: string = '';

  get password(): string {
    return this.pin1 + this.pin2 + this.pin3 + this.pin4 + this.pin5 + this.pin6;
  }

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  async onSubmit() {
    if (!this.name || !this.email || this.password.length !== 6) {
      Swal.fire({
        icon: 'warning',
        title: 'Campos incompletos',
        text: 'Todos los campos son obligatorios y la contraseña debe tener 6 dígitos'
      });
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    const result = await this.authService.register(this.name, this.email, this.password);
    
    if (result.success) {
      Swal.fire({
        icon: 'success',
        title: '¡Registro exitoso!',
        text: 'Usuario registrado correctamente',
        timer: 2000,
        showConfirmButton: false
      }).then(() => {
        this.router.navigate(['/']);
      });
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Error en el registro',
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
      }
    }
  }

  onPinKeydown(event: any, position: number) {
    // Permitir backspace para ir al campo anterior
    if (event.key === 'Backspace' && !event.target.value && position > 1) {
      const prevInput = document.querySelector(`input[name="pin${position - 1}"]`) as HTMLInputElement;
      if (prevInput) {
        prevInput.focus();
      }
    }
  }
}