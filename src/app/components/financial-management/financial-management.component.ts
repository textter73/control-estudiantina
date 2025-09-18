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
    });
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

  async processTransaction() {
    if (!this.selectedAccount || this.transactionAmount <= 0 || !this.transactionConcept) {
      Swal.fire('Error', 'Complete todos los campos', 'error');
      return;
    }

    if (this.transactionType === 'withdrawal') {
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
    if (this.selectedAccount.balance < this.transactionAmount) {
      Swal.fire('Error', 'Saldo insuficiente', 'error');
      return;
    }

    // Solicitar contraseña del usuario
    const { value: password } = await Swal.fire({
      title: 'Confirmar Retiro',
      text: `Ingrese la contraseña de ${this.selectedAccount.userName}`,
      input: 'password',
      inputPlaceholder: 'Contraseña',
      showCancelButton: true,
      confirmButtonText: 'Confirmar Retiro',
      cancelButtonText: 'Cancelar'
    });

    if (!password) return;

    // Verificar contraseña
    try {
      const userDoc = await this.firestore.collection('users').doc(this.selectedAccount.userId).get().toPromise();
      const userData = userDoc?.data();
      
      // Aquí deberías verificar la contraseña hasheada, por simplicidad usamos comparación directa
      // En producción, usar bcrypt o similar
      if ((userData as any)?.password !== password) {
        Swal.fire('Error', 'Contraseña incorrecta', 'error');
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
        authorizedBy: this.selectedAccount.userId
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