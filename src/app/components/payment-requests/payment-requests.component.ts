import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-payment-requests',
  templateUrl: './payment-requests.component.html',
  styleUrls: ['./payment-requests.component.css']
})
export class PaymentRequestsComponent implements OnInit {
  user: any = null;
  userProfile: any = null;
  paymentRequests: any[] = [];
  allUsers: any[] = [];
  filteredUsers: any[] = [];
  userSearchTerm: string = '';
  showCreateModal = false;
  showDetailsModal = false;
  selectedRequest: any = null;
  requestNotifications: any[] = [];
  pendingPayments: any[] = [];
  completedPayments: any[] = [];
  allNotifications: any[] = []; // Para estadísticas generales
  partialPayments: any[] = []; // Para pagos parciales de cada usuario
  allPartialPayments: any[] = []; // Todos los pagos parciales para estadísticas
  showAddPaymentModal = false;
  selectedPayment: any = null;
  activeTab: string = 'pending'; // Nueva propiedad para controlar pestañas
  newPartialPayment = {
    amount: 0,
    description: ''
  };
  
  // Formulario para nueva solicitud
  newRequest = {
    concept: '',
    defaultAmount: 0,
    dueDate: '',
    description: '',
    individualQuotas: [] as any[] // Array de {userId: string, amount: number, userInfo: any}
  };

  showQuotaStep = false;

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
        
        if (this.canManagePayments()) {
          this.loadPaymentRequests();
          this.loadAllUsers();
          this.loadAllNotifications();
          this.loadAllPartialPayments();
        } else {
          this.router.navigate(['/dashboard']);
        }
      } else {
        this.router.navigate(['/']);
      }
    });
  }

  canManagePayments(): boolean {
    return this.userProfile?.profiles?.includes('administrador') || 
           this.userProfile?.profiles?.includes('finanzas') || false;
  }

  loadPaymentRequests() {
    this.firestore.collection('payment-requests', ref => 
      ref.where('createdBy', '==', this.user.uid)
    ).valueChanges({ idField: 'id' }).subscribe((requests: any[]) => {
      // Ordenar en el cliente por fecha de creación
      this.paymentRequests = requests.sort((a, b) => {
        const dateA = a.createdAt?.toDate() || new Date();
        const dateB = b.createdAt?.toDate() || new Date();
        return dateB.getTime() - dateA.getTime(); // desc order
      });
      
      // Separar pagos por estado
      this.separatePaymentsByStatus();
    });
  }
  
  separatePaymentsByStatus() {
    this.pendingPayments = [];
    this.completedPayments = [];
    
    for (const request of this.paymentRequests) {
      const stats = this.getRequestStats(request.concept);
      if (stats.completed === stats.total && stats.total > 0) {
        this.completedPayments.push(request);
      } else {
        this.pendingPayments.push(request);
      }
    }
  }

  loadAllUsers() {
    this.firestore.collection('users').valueChanges({ idField: 'id' }).subscribe((users: any[]) => {
      this.allUsers = users; // Incluir todos los usuarios, incluyendo el usuario actual
      this.filteredUsers = [...this.allUsers];
    });
  }

  loadAllNotifications() {
    this.firestore.collection('payment-notifications', ref => 
      ref.where('createdBy', '==', this.user.uid)
    ).valueChanges({ idField: 'id' }).subscribe((notifications: any[]) => {
      this.allNotifications = notifications;
      // Actualizar separación cuando cambien las notificaciones
      this.separatePaymentsByStatus();
    });
  }

  loadAllPartialPayments() {
    this.firestore.collection('partial-payments', ref => 
      ref.where('createdBy', '==', this.user.uid)
    ).valueChanges({ idField: 'id' }).subscribe((payments: any[]) => {
      this.allPartialPayments = payments.sort((a, b) => {
        const dateA = a.createdAt?.toDate() || new Date(0);
        const dateB = b.createdAt?.toDate() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
      // Actualizar separación cuando cambien los pagos parciales
      this.separatePaymentsByStatus();
    });
  }

  openCreateModal() {
    this.showCreateModal = true;
    this.resetForm();
  }

  closeCreateModal() {
    this.showCreateModal = false;
    this.resetForm();
  }

  resetForm() {
    this.newRequest = {
      concept: '',
      defaultAmount: 0,
      dueDate: '',
      description: '',
      individualQuotas: []
    };
    this.userSearchTerm = '';
    this.filteredUsers = [...this.allUsers];
    this.showQuotaStep = false;
  }

  toggleUserSelection(userId: string) {
    const existingIndex = this.newRequest.individualQuotas.findIndex(q => q.userId === userId);
    if (existingIndex > -1) {
      this.newRequest.individualQuotas.splice(existingIndex, 1);
    } else {
      const user = this.allUsers.find(u => u.id === userId);
      this.newRequest.individualQuotas.push({
        userId: userId,
        amount: this.newRequest.defaultAmount,
        userInfo: user
      });
    }
  }

  isUserSelected(userId: string): boolean {
    return this.newRequest.individualQuotas.some(q => q.userId === userId);
  }

  selectAllUsers() {
    // Agregar todos los usuarios filtrados que no estén ya seleccionados
    this.filteredUsers.forEach(user => {
      if (!this.isUserSelected(user.id)) {
        this.newRequest.individualQuotas.push({
          userId: user.id,
          amount: this.newRequest.defaultAmount,
          userInfo: user
        });
      }
    });
  }

  clearAllUsers() {
    this.newRequest.individualQuotas = [];
  }

  // Nuevos métodos para manejar cuotas individuales
  updateQuotaAmount(userId: string, amount: number) {
    const quota = this.newRequest.individualQuotas.find(q => q.userId === userId);
    if (quota) {
      quota.amount = amount;
    }
  }

  proceedToQuotaStep() {
    if (this.newRequest.individualQuotas.length === 0) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Selecciona al menos un integrante para continuar'
      });
      return;
    }
    this.showQuotaStep = true;
  }

  backToUserSelection() {
    this.showQuotaStep = false;
  }

  applyDefaultAmountToAll() {
    this.newRequest.individualQuotas.forEach(quota => {
      quota.amount = this.newRequest.defaultAmount;
    });
  }

  trackByUserId(index: number, item: any): string {
    return item.userId;
  }

  getTotalAmount(): number {
    return this.newRequest.individualQuotas.reduce((sum, quota) => sum + quota.amount, 0);
  }

  // Métodos para el resumen de totales basados en pagos parciales
  getPendingCount(): number {
    let pendingCount = 0;
    for (const notification of this.allNotifications) {
      const totalPaid = this.getTotalPaidByUserForConcept(notification.userId, notification.concept);
      if (totalPaid < notification.amount) {
        pendingCount++;
      }
    }
    return pendingCount;
  }

  getPendingTotal(): number {
    let pendingTotal = 0;
    for (const notification of this.allNotifications) {
      const totalPaid = this.getTotalPaidByUserForConcept(notification.userId, notification.concept);
      const remaining = Math.max(0, notification.amount - totalPaid);
      pendingTotal += remaining;
    }
    return pendingTotal;
  }

  getCompletedCount(): number {
    let completedCount = 0;
    for (const notification of this.allNotifications) {
      const totalPaid = this.getTotalPaidByUserForConcept(notification.userId, notification.concept);
      if (totalPaid >= notification.amount) {
        completedCount++;
      }
    }
    return completedCount;
  }

  // Métodos para estadísticas por concepto de solicitud basados en pagos parciales
  getRequestStats(concept: string) {
    const relatedNotifications = this.allNotifications.filter(notification => notification.concept === concept);
    let completed = 0;
    let pending = 0;
    let totalPaidAmount = 0;
    let totalDueAmount = 0;

    for (const notification of relatedNotifications) {
      const userPaid = this.getTotalPaidByUserForConcept(notification.userId, notification.concept);
      totalPaidAmount += userPaid;
      totalDueAmount += notification.amount;
      
      if (userPaid >= notification.amount) {
        completed++;
      } else {
        pending++;
      }
    }
    
    const total = relatedNotifications.length;
    const completedPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    const amountPercentage = totalDueAmount > 0 ? Math.round((totalPaidAmount / totalDueAmount) * 100) : 0;
    
    return {
      completed,
      pending,
      total,
      completedPercentage,
      amountPercentage,
      totalPaid: totalPaidAmount,
      totalDue: totalDueAmount,
      totalPending: totalDueAmount - totalPaidAmount
    };
  }

  // Método helper para obtener el total pagado por un usuario para un concepto específico
  getTotalPaidByUserForConcept(userId: string, concept: string): number {
    if (!this.allPartialPayments || this.allPartialPayments.length === 0) {
      return 0;
    }
    
    return this.allPartialPayments
      .filter((p: any) => p.userId === userId && p.concept === concept)
      .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
  }

  filterUsers() {
    if (!this.userSearchTerm.trim()) {
      this.filteredUsers = [...this.allUsers];
    } else {
      const searchTerm = this.userSearchTerm.toLowerCase().trim();
      this.filteredUsers = this.allUsers.filter(user => 
        (user.name && user.name.toLowerCase().includes(searchTerm)) ||
        (user.email && user.email.toLowerCase().includes(searchTerm))
      );
    }
  }

  async createPaymentRequest() {
    if (!this.validateForm()) {
      return;
    }

    try {
      const batch = this.firestore.firestore.batch();
      const paymentRequestIds: string[] = [];

      // Crear una solicitud individual para cada cuota definida
      for (const quota of this.newRequest.individualQuotas) {
        const paymentRequestRef = this.firestore.firestore.collection('payment-requests').doc();
        
        const paymentRequest = {
          concept: this.newRequest.concept,
          amount: quota.amount,
          dueDate: new Date(this.newRequest.dueDate),
          description: this.newRequest.description,
          recipientId: quota.userId,
          recipientEmail: quota.userInfo?.email || '',
          recipientName: quota.userInfo?.displayName || quota.userInfo?.email || '',
          createdBy: this.user.uid,
          createdByName: this.userProfile.name || this.user.email,
          createdAt: new Date(),
          status: 'pending'
        };

        batch.set(paymentRequestRef, paymentRequest);
        paymentRequestIds.push(paymentRequestRef.id);

        // Crear notificación para este usuario específico
        const notificationRef = this.firestore.firestore.collection('payment-notifications').doc();
        const notification = {
          paymentRequestId: paymentRequestRef.id,
          userId: quota.userId,
          concept: this.newRequest.concept,
          amount: quota.amount,
          dueDate: new Date(this.newRequest.dueDate),
          description: this.newRequest.description,
          createdBy: this.user.uid,
          createdByName: this.userProfile.name || this.user.email,
          createdAt: new Date(),
          status: 'pending',
          read: false
        };
        batch.set(notificationRef, notification);
      }

      // Ejecutar todas las operaciones en batch
      await batch.commit();

      Swal.fire({
        icon: 'success',
        title: '¡Cuotas creadas!',
        text: `Se han creado ${this.newRequest.individualQuotas.length} cuotas individuales.`,
        timer: 3000,
        showConfirmButton: false
      });

      this.closeCreateModal();
    } catch (error) {
      console.error('Error creating payment request:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo crear la solicitud de pago. Inténtalo de nuevo.'
      });
    }
  }

  validateForm(): boolean {
    if (!this.newRequest.concept.trim()) {
      Swal.fire('Error', 'El concepto es obligatorio', 'error');
      return false;
    }
    
    if (this.newRequest.individualQuotas.length === 0) {
      Swal.fire('Error', 'Debes seleccionar al menos una persona', 'error');
      return false;
    }

    // Validar que todas las cuotas tengan montos válidos
    const invalidQuotas = this.newRequest.individualQuotas.filter(q => q.amount <= 0);
    if (invalidQuotas.length > 0) {
      Swal.fire('Error', 'Todos los montos deben ser mayores a 0', 'error');
      return false;
    }
    
    if (!this.newRequest.dueDate) {
      Swal.fire('Error', 'La fecha límite es obligatoria', 'error');
      return false;
    }
    
    return true;
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'active': return 'status-active';
      case 'completed': return 'status-completed';
      case 'cancelled': return 'status-cancelled';
      default: return 'status-pending';
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'active': return 'Activa';
      case 'completed': return 'Completada';
      case 'cancelled': return 'Cancelada';
      default: return 'Pendiente';
    }
  }

  getUserName(userId: string): string {
    const user = this.allUsers.find(u => u.id === userId);
    return user ? (user.name || user.email) : 'Usuario desconocido';
  }

  getTotalAmountForRequest(concept: string): number {
    return this.allNotifications
      .filter((n: any) => n.concept === concept)
      .reduce((sum: number, n: any) => sum + (n.amount || 0), 0);
  }

  getPendingAmountForRequest(concept: string): number {
    let pendingAmount = 0;
    const relatedNotifications = this.allNotifications.filter((n: any) => n.concept === concept);
    
    for (const notification of relatedNotifications) {
      const totalPaid = this.getTotalPaidByUserForConcept(notification.userId, notification.concept);
      const remaining = Math.max(0, notification.amount - totalPaid);
      pendingAmount += remaining;
    }
    
    return pendingAmount;
  }

  async viewRequestDetails(request: any) {
    this.selectedRequest = request;
    await this.loadRequestNotifications(request.concept);
    this.showDetailsModal = true;
  }

  async loadRequestNotifications(concept: string) {
    try {
      const notifications = await this.firestore.collection('payment-notifications', ref => 
        ref.where('concept', '==', concept)
      ).get().toPromise();

      this.requestNotifications = [];
      notifications?.forEach((doc: any) => {
        const data = doc.data();
        this.requestNotifications.push({
          id: doc.id,
          ...data
        });
      });

      // Cargar pagos parciales
      await this.loadPartialPayments(concept);

      // Separar en pendientes y completados basado en pagos parciales
      this.pendingPayments = [];
      this.completedPayments = [];

      for (const notification of this.requestNotifications) {
        const totalPaid = this.getTotalPaidByUser(notification.userId, concept);
        const quotaAmount = notification.amount;
        
        if (totalPaid >= quotaAmount) {
          this.completedPayments.push({
            ...notification,
            totalPaid,
            isFullyPaid: true
          });
        } else {
          this.pendingPayments.push({
            ...notification,
            totalPaid,
            remaining: quotaAmount - totalPaid,
            isFullyPaid: false
          });
        }
      }

      // Ordenar completados por fecha de último pago
      this.completedPayments.sort((a, b) => {
        const lastPaymentA = this.getLastPaymentDate(a.userId, concept);
        const lastPaymentB = this.getLastPaymentDate(b.userId, concept);
        return lastPaymentB.getTime() - lastPaymentA.getTime();
      });

    } catch (error) {
      console.error('Error loading request notifications:', error);
    }
  }

  async loadPartialPayments(concept: string) {
    try {
      const payments = await this.firestore.collection('partial-payments', ref => 
        ref.where('concept', '==', concept)
      ).get().toPromise();

      this.partialPayments = [];
      payments?.forEach((doc: any) => {
        const data = doc.data();
        this.partialPayments.push({
          id: doc.id,
          ...data
        });
      });

      // Ordenar en el cliente por fecha de creación (más recientes primero)
      this.partialPayments.sort((a, b) => {
        const dateA = a.createdAt?.toDate() || new Date(0);
        const dateB = b.createdAt?.toDate() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });

    } catch (error) {
      console.error('Error loading partial payments:', error);
      this.partialPayments = [];
    }
  }

  getTotalPaidByUser(userId: string, concept: string): number {
    return this.partialPayments
      .filter(p => p.userId === userId && p.concept === concept)
      .reduce((sum, p) => sum + (p.amount || 0), 0);
  }

  getLastPaymentDate(userId: string, concept: string): Date {
    const userPayments = this.partialPayments
      .filter(p => p.userId === userId && p.concept === concept)
      .sort((a, b) => b.createdAt?.toDate().getTime() - a.createdAt?.toDate().getTime());
    
    return userPayments.length > 0 ? userPayments[0].createdAt?.toDate() : new Date(0);
  }

  getPaymentsByUser(userId: string, concept: string): any[] {
    return this.partialPayments
      .filter(p => p.userId === userId && p.concept === concept)
      .sort((a, b) => {
        const dateA = a.createdAt?.toDate() || new Date(0);
        const dateB = b.createdAt?.toDate() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
  }

  getMaxPaymentAmount(): number {
    if (!this.selectedPayment) return 0;
    return this.selectedPayment.remaining || this.selectedPayment.amount || 0;
  }

  closeDetailsModal() {
    this.showDetailsModal = false;
    this.selectedRequest = null;
    this.requestNotifications = [];
    this.pendingPayments = [];
    this.completedPayments = [];
    this.partialPayments = [];
  }

  openAddPaymentModal(payment: any) {
    this.selectedPayment = payment;
    this.newPartialPayment = {
      amount: 0,
      description: ''
    };
    this.showAddPaymentModal = true;
  }

  closeAddPaymentModal() {
    this.showAddPaymentModal = false;
    this.selectedPayment = null;
    this.newPartialPayment = {
      amount: 0,
      description: ''
    };
  }

  async addPartialPayment() {
    // Validaciones más robustas
    if (!this.selectedPayment) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No hay un pago seleccionado'
      });
      return;
    }

    if (!this.selectedPayment.userId || !this.selectedPayment.concept) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Información de pago incompleta'
      });
      return;
    }

    if (!this.newPartialPayment.amount || this.newPartialPayment.amount <= 0) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Ingresa un monto válido para el pago'
      });
      return;
    }

    const quotaAmount = this.selectedPayment.amount || this.selectedPayment.remaining || 0;
    if (quotaAmount <= 0) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se puede determinar el monto de la cuota'
      });
      return;
    }

    const totalPaid = this.getTotalPaidByUser(this.selectedPayment.userId, this.selectedPayment.concept);
    const remaining = quotaAmount - totalPaid;

    if (this.newPartialPayment.amount > remaining) {
      Swal.fire({
        icon: 'error',
        title: 'Monto excedido',
        text: `El monto no puede ser mayor al pendiente ($${remaining.toFixed(2)})`
      });
      return;
    }

    try {
      const result = await Swal.fire({
        title: '¿Registrar pago?',
        text: `Registrar pago de $${this.newPartialPayment.amount} para ${this.getUserName(this.selectedPayment.userId)}`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#16a34a',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, registrar',
        cancelButtonText: 'Cancelar'
      });

      if (result.isConfirmed) {
        const partialPayment = {
          userId: this.selectedPayment.userId,
          concept: this.selectedPayment.concept,
          amount: this.newPartialPayment.amount,
          description: this.newPartialPayment.description,
          paymentRequestId: this.selectedPayment.paymentRequestId || this.selectedPayment.id,
          createdBy: this.user.uid,
          createdByName: this.userProfile.name || this.user.email,
          createdAt: new Date()
        };

        await this.firestore.collection('partial-payments').add(partialPayment);

        // Verificar si con este pago se completa la cuota
        const newTotalPaid = totalPaid + this.newPartialPayment.amount;
        if (newTotalPaid >= quotaAmount) {
          // Marcar la notificación como completada
          await this.firestore.collection('payment-notifications').doc(this.selectedPayment.id).update({
            status: 'completed',
            paidAt: new Date()
          });

          // También actualizar la solicitud de pago si existe
          if (this.selectedPayment.paymentRequestId) {
            await this.firestore.collection('payment-requests').doc(this.selectedPayment.paymentRequestId).update({
              status: 'completed',
              paidAt: new Date()
            });
          }
        }

        // Recargar datos
        await this.loadRequestNotifications(this.selectedRequest.concept);
        this.loadPaymentRequests();
        this.loadAllNotifications();
        this.loadAllPartialPayments();

        this.closeAddPaymentModal();

        Swal.fire({
          icon: 'success',
          title: '¡Pago registrado!',
          text: newTotalPaid >= quotaAmount ? 
            'La cuota ha sido completada' : 
            `Pago registrado. Pendiente: $${(quotaAmount - newTotalPaid).toFixed(2)}`,
          timer: 3000,
          showConfirmButton: false
        });
      }
    } catch (error) {
      console.error('Error adding partial payment:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo registrar el pago'
      });
    }
  }

  async markPaymentAsCompleted(notificationId: string, notification: any) {
    try {
      const result = await Swal.fire({
        title: '¿Marcar como pagado?',
        text: `Confirmar pago de ${notification.amount} por ${this.getUserName(notification.userId)}`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#16a34a',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, marcar como pagado',
        cancelButtonText: 'Cancelar'
      });

      if (result.isConfirmed) {
        // Actualizar la notificación
        await this.firestore.collection('payment-notifications').doc(notificationId).update({
          status: 'completed',
          paidAt: new Date()
        });

        // También actualizar la solicitud de pago correspondiente
        if (notification.paymentRequestId) {
          await this.firestore.collection('payment-requests').doc(notification.paymentRequestId).update({
            status: 'completed',
            paidAt: new Date()
          });
        }

        // Recargar las notificaciones para actualizar la vista
        await this.loadRequestNotifications(this.selectedRequest.concept);
        // Recargar también las solicitudes principales y notificaciones globales
        this.loadPaymentRequests();
        this.loadAllNotifications();

        Swal.fire({
          icon: 'success',
          title: '¡Pago confirmado!',
          text: 'El pago ha sido marcado como completado',
          timer: 2000,
          showConfirmButton: false
        });
      }
    } catch (error) {
      console.error('Error marking payment as completed:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo confirmar el pago'
      });
    }
  }

  async markAsCompleted(requestId: string) {
    try {
      const result = await Swal.fire({
        title: '¿Marcar como pagada?',
        text: 'Confirma que esta solicitud ha sido completamente pagada',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#16a34a',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, marcar como pagada',
        cancelButtonText: 'Cancelar'
      });

      if (result.isConfirmed) {
        await this.firestore.collection('payment-requests').doc(requestId).update({
          status: 'completed',
          completedAt: new Date()
        });

        // También actualizar la notificación relacionada
        const notifications = await this.firestore.firestore.collection('payment-notifications')
          .where('paymentRequestId', '==', requestId)
          .get();

        const batch = this.firestore.firestore.batch();
        notifications.forEach((doc: any) => {
          batch.update(doc.ref, { 
            status: 'completed',
            completedAt: new Date()
          });
        });
        await batch.commit();

        Swal.fire({
          icon: 'success',
          title: '¡Solicitud completada!',
          text: 'La solicitud ha sido marcada como pagada',
          timer: 2000,
          showConfirmButton: false
        });
      }
    } catch (error) {
      console.error('Error marking request as completed:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo marcar la solicitud como completada'
      });
    }
  }

  async cancelRequest(requestId: string) {
    try {
      const result = await Swal.fire({
        title: '¿Cancelar solicitud?',
        text: 'Esta acción no se puede deshacer',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, cancelar',
        cancelButtonText: 'No'
      });

      if (result.isConfirmed) {
        await this.firestore.collection('payment-requests').doc(requestId).update({
          status: 'cancelled'
        });

        Swal.fire({
          icon: 'success',
          title: 'Solicitud cancelada',
          text: 'La solicitud ha sido cancelada correctamente',
          timer: 2000,
          showConfirmButton: false
        });
      }
    } catch (error) {
      console.error('Error canceling request:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo cancelar la solicitud'
      });
    }
  }

  // Métodos para manejar las pestañas
  setActiveTab(tab: string) {
    this.activeTab = tab;
  }

  getFilteredRequests() {
    if (this.activeTab === 'pending') {
      return this.pendingPayments;
    } else {
      return this.completedPayments;
    }
  }

  getPendingRequestsCount(): number {
    return this.pendingPayments.length;
  }

  getCompletedRequestsCount(): number {
    return this.completedPayments.length;
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }
}
