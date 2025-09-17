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
  password: string = '';
  showPassword: boolean = false;
  loading: boolean = false;
  errorMessage: string = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  async onSubmit() {
    if (!this.name || !this.email || !this.password) {
      Swal.fire({
        icon: 'warning',
        title: 'Campos incompletos',
        text: 'Todos los campos son obligatorios'
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

  togglePassword() {
    this.showPassword = !this.showPassword;
  }
}