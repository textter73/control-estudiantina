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
  password: string = '';
  showPassword: boolean = false;
  loading: boolean = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  async onSubmit() {
    if (!this.email || !this.password) {
      Swal.fire({
        icon: 'warning',
        title: 'Campos incompletos',
        text: 'Email y contraseña son obligatorios'
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

  togglePassword() {
    this.showPassword = !this.showPassword;
  }
}