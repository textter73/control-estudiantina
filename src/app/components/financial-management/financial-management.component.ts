import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';

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
  
  // Modal de movimientos
  showMovementsModal = false;
  cardMovements: any[] = [];
  filteredMovements: any[] = [];
  movementFilter: string = 'all';
  usersMap: { [key: string]: string } = {};
  
  // Modal de estado de cuenta
  showStatementModal = false;
  statementData: any = null;
  statementMovements: any[] = [];

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
      // Filtrar usuarios que no están desactivados
      this.users = users.filter(user => !user.deleted);
      // Crear un mapa de ID -> nombre para búsqueda rápida
      this.usersMap = {};
      this.users.forEach(user => {
        this.usersMap[user.id] = user.name || user.email || 'Usuario desconocido';
      });
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

  getTotalBalance(): number {
    return this.accounts.reduce((total, account) => total + (account.balance || 0), 0);
  }

  getAverageBalance(): number {
    if (this.accounts.length === 0) return 0;
    return this.getTotalBalance() / this.accounts.length;
  }

  getEstudiantinaBalance(): number {
    const estudiantinaAccount = this.accounts.find(account => 
      account.userName?.toLowerCase().includes('estudiantina tonantzin') ||
      account.userName === 'Estudiantina Tonantzin Guadalupe'
    );
    return estudiantinaAccount ? (estudiantinaAccount.balance || 0) : 0;
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

  // Métodos para el modal de movimientos
  getUserName(userId: string): string {
    return this.usersMap[userId] || 'Usuario desconocido';
  }

  viewCardMovements(account: any) {
    if (!account) return;
    
    this.selectedAccount = account;
    this.loadCardMovements();
    this.showMovementsModal = true;
  }

  loadCardMovements() {
    if (!this.selectedAccount) return;
    
    // Consulta sin orderBy para evitar el error del índice
    this.firestore.collection('financial-transactions', ref => 
      ref.where('accountId', '==', this.selectedAccount.id)
    ).valueChanges({ idField: 'id' }).subscribe((movements: any[]) => {
      // Ordenamos en el cliente para evitar el error del índice
      this.cardMovements = movements.sort((a, b) => {
        const timestampA = a.createdAt?.toDate() || new Date(0);
        const timestampB = b.createdAt?.toDate() || new Date(0);
        return timestampB.getTime() - timestampA.getTime(); // Orden descendente
      });
      this.filterMovements();
    });
  }

  filterMovements() {
    if (this.movementFilter === 'all') {
      this.filteredMovements = this.cardMovements;
    } else {
      this.filteredMovements = this.cardMovements.filter(movement => 
        movement.type === this.movementFilter
      );
    }
  }

  onMovementFilterChange() {
    this.filterMovements();
  }

  closeMovementsModal() {
    this.showMovementsModal = false;
    this.cardMovements = [];
    this.filteredMovements = [];
    this.movementFilter = 'all';
    this.selectedAccount = null;
  }

  async downloadAccountStatement(account: any) {
    try {
      // Obtener movimientos de la cuenta
      const movementsSnapshot = await this.firestore.collection('financial-transactions', ref =>
        ref.where('accountId', '==', account.id)
      ).get().toPromise();

      const movements = movementsSnapshot?.docs.map(doc => doc.data()) || [];
      const sortedMovements = movements.sort((a: any, b: any) => {
        const timestampA = a.createdAt?.toDate() || new Date(0);
        const timestampB = b.createdAt?.toDate() || new Date(0);
        return timestampB.getTime() - timestampA.getTime();
      });

      // Preparar datos para el modal de previsualización
      const currentDate = new Date().toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      this.statementData = {
        account: account,
        emissionDate: currentDate,
        status: account.status === 'active' ? 'Activa' : 'Inactiva'
      };
      this.statementMovements = sortedMovements;
      this.showStatementModal = true;
    } catch (error) {
      console.error('Error loading account statement:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo cargar el estado de cuenta'
      });
    }
  }

  closeStatementModal() {
    this.showStatementModal = false;
    this.statementData = null;
    this.statementMovements = [];
  }

  downloadAsPDF() {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width || doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
      let yPos = 20;

      // Encabezado
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('ESTUDIANTINA TONANTZIN GUADALUPE', pageWidth / 2, yPos, { align: 'center' });
      yPos += 8;
      
      doc.setFontSize(14);
      doc.text('ESTADO DE CUENTA', pageWidth / 2, yPos, { align: 'center' });
      yPos += 10;

      // Línea separadora
      doc.setLineWidth(0.5);
      doc.line(15, yPos, pageWidth - 15, yPos);
      yPos += 10;

      // Fecha de emisión
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Fecha de emisión: ${this.statementData.emissionDate}`, 15, yPos);
      yPos += 10;

      // Información de la cuenta
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('INFORMACIÓN DE LA CUENTA', 15, yPos);
      yPos += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Titular: ${this.statementData.account.userName}`, 15, yPos);
      yPos += 6;
      doc.text(`Número de cuenta: ${this.statementData.account.accountNumber}`, 15, yPos);
      yPos += 6;
      doc.text(`Número de tarjeta: ${this.statementData.account.cardNumber}`, 15, yPos);
      yPos += 6;
      doc.text(`Saldo disponible: $${this.statementData.account.balance.toFixed(2)}`, 15, yPos);
      yPos += 6;
      doc.text(`Estado: ${this.statementData.status}`, 15, yPos);
      yPos += 15;

      // Movimientos - Tabla Manual
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('MOVIMIENTOS', 15, yPos);
      yPos += 8;

      if (this.statementMovements.length === 0) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.text('No hay movimientos registrados', 15, yPos);
        yPos += 10;
      } else {
        // Definir columnas de la tabla
        const tableX = 15;
        const tableWidth = pageWidth - 30;
        const col1 = tableX; // #
        const col2 = col1 + 12; // Fecha
        const col3 = col2 + 40; // Tipo
        const col4 = col3 + 25; // Concepto
        const col5 = col4 + 55; // Monto
        const col6 = col5 + 30; // Saldo
        const rowHeight = 7;

        // Función para dibujar encabezados de tabla
        const drawTableHeader = (startY: number) => {
          doc.setFillColor(24, 157, 152); // Color turquesa
          doc.rect(tableX, startY, tableWidth, 8, 'F');
          
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          
          doc.text('#', col1 + 2, startY + 5.5);
          doc.text('Fecha', col2 + 2, startY + 5.5);
          doc.text('Tipo', col3 + 2, startY + 5.5);
          doc.text('Concepto', col4 + 2, startY + 5.5);
          doc.text('Monto', col5 + 2, startY + 5.5);
          doc.text('Saldo Después', col6 + 2, startY + 5.5);
          
          doc.setTextColor(0, 0, 0);
          return startY + 8;
        };

        // Dibujar encabezado inicial
        yPos = drawTableHeader(yPos);

        // Dibujar filas de datos
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');

        this.statementMovements.forEach((movement: any, index: number) => {
          // Verificar si necesitamos nueva página
          if (yPos > pageHeight - 35) {
            doc.addPage();
            yPos = 20;
            yPos = drawTableHeader(yPos);
          }

          const date = movement.createdAt?.toDate()?.toLocaleDateString('es-MX', {
            year: '2-digit',
            month: '2-digit',
            day: '2-digit'
          }) || 'N/A';
          const time = movement.createdAt?.toDate()?.toLocaleTimeString('es-MX', {
            hour: '2-digit',
            minute: '2-digit'
          }) || '';
          const type = movement.type === 'deposit' ? 'DEPÓSITO' : 'RETIRO';
          const concept = movement.concept || 'Sin concepto';
          const amount = movement.type === 'deposit' ? `+$${movement.amount.toFixed(2)}` : `-$${movement.amount.toFixed(2)}`;
          const balance = movement.balanceAfter ? `$${movement.balanceAfter.toFixed(2)}` : 'N/A';

          // Fondo de fila alternado
          if (index % 2 === 0) {
            doc.setFillColor(245, 245, 245);
            doc.rect(tableX, yPos, tableWidth, rowHeight, 'F');
          }

          // Dibujar datos
          doc.setFont('helvetica', 'normal');
          doc.text((index + 1).toString(), col1 + 2, yPos + 5);
          doc.text(date, col2 + 2, yPos + 3.5);
          doc.text(time, col2 + 2, yPos + 6, { maxWidth: 35 });
          doc.text(type, col3 + 2, yPos + 5);
          
          // Concepto con límite de ancho
          const conceptLines = doc.splitTextToSize(concept, 50);
          doc.text(conceptLines[0], col4 + 2, yPos + 5);
          
          doc.text(amount, col5 + 2, yPos + 5);
          doc.text(balance, col6 + 2, yPos + 5);

          // Línea divisoria
          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.1);
          doc.line(tableX, yPos + rowHeight, tableX + tableWidth, yPos + rowHeight);

          yPos += rowHeight;
        });
        
        yPos += 5;
      }

      // Pie de página
      const finalY = yPos || 20;
      const footerY = pageHeight - 15;
      
      // Si hay espacio suficiente en la página actual, usar esa página, si no, agregar nueva
      if (finalY > pageHeight - 30) {
        doc.addPage();
        doc.setLineWidth(0.5);
        doc.line(15, pageHeight - 20, pageWidth - 15, pageHeight - 20);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.text('Documento generado automáticamente', pageWidth / 2, pageHeight - 15, { align: 'center' });
        doc.text('Estudiantina Tonantzin Guadalupe', pageWidth / 2, pageHeight - 11, { align: 'center' });
      } else {
        doc.setLineWidth(0.5);
        doc.line(15, footerY - 5, pageWidth - 15, footerY - 5);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.text('Documento generado automáticamente', pageWidth / 2, footerY, { align: 'center' });
        doc.text('Estudiantina Tonantzin Guadalupe', pageWidth / 2, footerY + 4, { align: 'center' });
      }

      // Guardar PDF
      const fileName = `Estado_Cuenta_${this.statementData.account.accountNumber}_${new Date().getTime()}.pdf`;
      doc.save(fileName);

      Swal.fire({
        icon: 'success',
        title: '¡PDF descargado!',
        text: 'El estado de cuenta ha sido descargado exitosamente',
        timer: 2000,
        showConfirmButton: false
      });

      this.closeStatementModal();
    } catch (error) {
      console.error('Error generating PDF:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo generar el PDF'
      });
    }
  }

  getMovementIcon(type: string): string {
    switch (type) {
      case 'deposit': return '💰';
      case 'withdrawal': return '💸';
      default: return '💳';
    }
  }

  getMovementTypeText(type: string): string {
    switch (type) {
      case 'deposit': return 'Depósito';
      case 'withdrawal': return 'Retiro';
      default: return type;
    }
  }

  getMovementClass(type: string): string {
    switch (type) {
      case 'deposit': return 'movement-deposit';
      case 'withdrawal': return 'movement-withdrawal';
      default: return '';
    }
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }
}