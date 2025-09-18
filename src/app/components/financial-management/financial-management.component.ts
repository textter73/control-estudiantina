import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-financial-management',
  templateUrl: './financial-management.component.html',
  styleUrls: ['./financial-management.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class FinancialManagementComponent implements OnInit {
  user: any = null;
  userProfile: any = null;
  users: any[] = [];
  accounts: any[] = [];
  filteredAccounts: any[] = [];
  searchTerm: string = '';
  selectedUser: any = null;
  selectedAccount: any = null;
  showTransactionModal = false;
  transactionType: 'deposit' | 'withdrawal' = 'deposit';
  transactionAmount = 0;
  transactionConcept = '';

  constructor(
    private firestore: AngularFirestore,
    private afAuth: AngularFireAuth,
    private router: Router
  ) {}

  ngOnInit() {
    this.afAuth.authState.subscribe(async (user) => {
      if (user) {
        this.user = user;
        const userDoc = await this.firestore.collection('users').doc(user.uid).get().toPromise();
        this.userProfile = userDoc?.data();
        
        if (this.canManageFinances()) {
          this.loadUsers();
          this.loadAccounts();
        } else {
          this.router.navigate(['/dashboard']);
        }
      } else {
        this.router.navigate(['/']);
      }
    });
  }

  canManageFinances(): boolean {
    return this.userProfile?.profiles?.includes('administrador') || 
           this.userProfile?.profiles?.includes('finanzas') || false;
  }

  loadUsers() {
    this.firestore.collection('users').valueChanges({ idField: 'id' }).subscribe((users: any[]) => {
      this.users = users;
    });
  }

  loadAccounts() {
    this.firestore.collection('financial-accounts').valueChanges({ idField: 'id' }).subscribe((accounts: any[]) => {
      this.accounts = accounts;
      this.filteredAccounts = accounts;
      this.filterAccounts();
    });
  }

  filterAccounts() {
    if (!this.searchTerm || this.searchTerm.trim() === '') {
      this.filteredAccounts = this.accounts;
    } else {
      const searchTermLower = this.searchTerm.toLowerCase();
      this.filteredAccounts = this.accounts.filter(account => 
        account.userName?.toLowerCase().includes(searchTermLower) ||
        account.accountNumber?.toLowerCase().includes(searchTermLower) ||
        account.cardNumber?.toLowerCase().includes(searchTermLower)
      );
    }
  }

  onSearchChange() {
    this.filterAccounts();
  }

  async createAccount(userId: string) {
    const user = this.users.find(u => u.id === userId);
    if (!user) return;

    const accountNumber = this.generateAccountNumber();
    const cardNumber = this.generateCardNumber();

    const account = {
      userId: userId,
      userName: user.name,
      accountNumber: accountNumber,
      cardNumber: cardNumber,
      balance: 0,
      status: 'active',
      createdAt: new Date(),
      createdBy: this.user.uid
    };

    try {
      await this.firestore.collection('financial-accounts').add(account);
      Swal.fire('Éxito', 'Cuenta creada exitosamente', 'success');
    } catch (error) {
      Swal.fire('Error', 'Error al crear la cuenta', 'error');
    }
  }

  generateAccountNumber(): string {
    return '4000' + Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
  }

  generateCardNumber(): string {
    return '5555' + Math.floor(Math.random() * 1000000000000).toString().padStart(12, '0');
  }

  openTransactionModal(account: any, type: 'deposit' | 'withdrawal') {
    this.selectedAccount = account;
    this.transactionType = type;
    this.transactionAmount = 0;
    this.transactionConcept = '';
    this.showTransactionModal = true;
  }

  closeTransactionModal() {
    this.showTransactionModal = false;
    this.selectedAccount = null;
  }

  validateTransactionAmount() {
    if (this.transactionType === 'withdrawal' && this.selectedAccount) {
      // Limitar el monto al saldo disponible si es mayor
      if (this.transactionAmount > this.selectedAccount.balance) {
        // No modificamos el valor automáticamente, solo mostramos la advertencia
        // El usuario debe corregir manualmente el monto
      }
    }
  }

  async processTransaction() {
    if (!this.selectedAccount || this.transactionAmount <= 0 || !this.transactionConcept) {
      Swal.fire('Error', 'Complete todos los campos correctamente', 'error');
      return;
    }

    // Validación específica para retiros
    if (this.transactionType === 'withdrawal') {
      if (this.transactionAmount > this.selectedAccount.balance) {
        Swal.fire({
          title: 'Error de Validación',
          html: `
            <p>❌ <strong>No se puede procesar el retiro</strong></p>
            <p>Monto solicitado: <strong>$${this.transactionAmount.toFixed(2)}</strong></p>
            <p>Saldo disponible: <strong>$${this.selectedAccount.balance.toFixed(2)}</strong></p>
            <p>Por favor, ingrese un monto menor o igual al saldo disponible.</p>
          `,
          icon: 'error',
          confirmButtonText: 'Entendido'
        });
        return;
      }
      await this.processWithdrawal();
    } else {
      await this.processDeposit();
    }
  }

  async processDeposit() {
    const newBalance = this.selectedAccount.balance + this.transactionAmount;
    
    const transaction = {
      accountId: this.selectedAccount.id,
      userId: this.selectedAccount.userId,
      type: 'deposit',
      amount: this.transactionAmount,
      concept: this.transactionConcept,
      balanceBefore: this.selectedAccount.balance,
      balanceAfter: newBalance,
      createdAt: new Date(),
      createdBy: this.user.uid
    };

    try {
      const batch = this.firestore.firestore.batch();
      
      // Actualizar balance
      const accountRef = this.firestore.collection('financial-accounts').doc(this.selectedAccount.id).ref;
      batch.update(accountRef, { balance: newBalance });
      
      // Crear transacción
      const transactionRef = this.firestore.collection('financial-transactions').doc().ref;
      batch.set(transactionRef, transaction);
      
      await batch.commit();
      
      Swal.fire('Éxito', 'Depósito realizado exitosamente', 'success');
      this.closeTransactionModal();
    } catch (error) {
      Swal.fire('Error', 'Error al procesar el depósito', 'error');
    }
  }

  async processWithdrawal() {
    // Validación más robusta del saldo
    if (!this.selectedAccount || !this.selectedAccount.balance) {
      Swal.fire('Error', 'No se pudo obtener el saldo de la cuenta', 'error');
      return;
    }

    if (this.transactionAmount <= 0) {
      Swal.fire('Error', 'El monto debe ser mayor a cero', 'error');
      return;
    }

    if (this.transactionAmount > this.selectedAccount.balance) {
      Swal.fire({
        title: 'Saldo Insuficiente',
        html: `
          <p>No se puede retirar <strong>$${this.transactionAmount.toFixed(2)}</strong></p>
          <p>Saldo disponible: <strong>$${this.selectedAccount.balance.toFixed(2)}</strong></p>
          <p>Faltante: <strong>$${(this.transactionAmount - this.selectedAccount.balance).toFixed(2)}</strong></p>
        `,
        icon: 'error',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    // Confirmar retiro sin contraseña
    const result = await Swal.fire({
      title: 'Confirmar Retiro',
      html: `
        <p>¿Está seguro de retirar <strong>$${this.transactionAmount.toFixed(2)}</strong> de la cuenta de <strong>${this.selectedAccount.userName}</strong>?</p>
        <p>Saldo actual: <strong>$${this.selectedAccount.balance.toFixed(2)}</strong></p>
        <p>Saldo después del retiro: <strong>$${(this.selectedAccount.balance - this.transactionAmount).toFixed(2)}</strong></p>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, confirmar retiro',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6'
    });

    if (!result.isConfirmed) return;

    try {
      // Verificar saldo una vez más antes de procesar (por seguridad)
      if (this.transactionAmount > this.selectedAccount.balance) {
        Swal.fire('Error', 'El saldo de la cuenta ha cambiado. Por favor, actualice la página e intente nuevamente.', 'error');
        return;
      }

      const newBalance = this.selectedAccount.balance - this.transactionAmount;
      
      const transaction = {
        accountId: this.selectedAccount.id,
        userId: this.selectedAccount.userId,
        type: 'withdrawal',
        amount: this.transactionAmount,
        concept: this.transactionConcept,
        balanceBefore: this.selectedAccount.balance,
        balanceAfter: newBalance,
        createdAt: new Date(),
        createdBy: this.user.uid,
        authorizedBy: this.user.uid // El administrador autoriza el retiro
      };

      const batch = this.firestore.firestore.batch();
      
      // Actualizar balance
      const accountRef = this.firestore.collection('financial-accounts').doc(this.selectedAccount.id).ref;
      batch.update(accountRef, { balance: newBalance });
      
      // Crear transacción
      const transactionRef = this.firestore.collection('financial-transactions').doc().ref;
      batch.set(transactionRef, transaction);
      
      await batch.commit();
      
      Swal.fire('Éxito', 'Retiro realizado exitosamente', 'success');
      this.closeTransactionModal();
    } catch (error) {
      Swal.fire('Error', 'Error al procesar el retiro', 'error');
    }
  }

  getUsersWithoutAccount() {
    return this.users.filter(user => 
      !this.accounts.some(account => account.userId === user.id)
    );
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }
}