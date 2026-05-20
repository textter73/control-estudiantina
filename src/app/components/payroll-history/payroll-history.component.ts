import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';

@Component({
  selector: 'app-payroll-history',
  templateUrl: './payroll-history.component.html',
  styleUrls: ['./payroll-history.component.css']
})
export class PayrollHistoryComponent implements OnInit {
  completedPayrolls: any[] = [];
  loading: boolean = true;

  constructor(
    private firestore: AngularFirestore,
    private router: Router
  ) {}

  async ngOnInit() {
    await this.loadCompletedPayrolls();
  }

  async loadCompletedPayrolls() {
    try {
      this.loading = true;
      const payrollsSnapshot = await this.firestore.collection('payrolls', ref =>
        ref.where('status', '==', 'completada')
      ).get().toPromise();

      if (!payrollsSnapshot || payrollsSnapshot.empty) {
        this.completedPayrolls = [];
        console.log('⚠️ No hay nóminas completadas');
        this.loading = false;
        return;
      }

      this.completedPayrolls = payrollsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as any)
      }));

      // Ordenar por fecha en memoria (más recientes primero)
      this.completedPayrolls.sort((a, b) => {
        const dateA = a.validatedAt?.toDate ? a.validatedAt.toDate() : new Date(a.validatedAt || 0);
        const dateB = b.validatedAt?.toDate ? b.validatedAt.toDate() : new Date(b.validatedAt || 0);
        return dateB.getTime() - dateA.getTime();
      });

      console.log(`✅ Nóminas completadas cargadas: ${this.completedPayrolls.length}`);
      this.loading = false;
    } catch (error) {
      console.error('❌ Error loading completed payrolls:', error);
      this.completedPayrolls = [];
      this.loading = false;
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudieron cargar las nóminas completadas'
      });
    }
  }

  get totalPaid(): number {
    return this.completedPayrolls.reduce((sum, p) => sum + (p.contractAmount || 0), 0);
  }

  get totalAttendees(): number {
    return this.completedPayrolls.reduce((sum, p) => sum + (p.attendees || 0), 0);
  }

  async viewPayrollPDF(payroll: any) {
    try {
      // Confirmar regeneración del PDF
      const result = await Swal.fire({
        title: '📄 Descargar Nómina General',
        html: `
          <p>Se regenerará y descargará el PDF de la nómina:</p>
          <br>
          <p><strong>Contrato:</strong> ${payroll.contractName}</p>
          <p><strong>Fecha:</strong> ${payroll.validatedAt?.toDate ? payroll.validatedAt.toDate().toLocaleDateString('es-MX') : 'N/A'}</p>
          <p><strong>Asistentes:</strong> ${payroll.attendees}</p>
          <p><strong>Total:</strong> $${payroll.contractAmount}</p>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, descargar',
        confirmButtonColor: '#189d98',
        cancelButtonText: 'Cancelar'
      });

      if (!result.isConfirmed) return;

      // Regenerar PDF con los datos guardados
      this.generatePayrollPDF(payroll);

      Swal.fire({
        icon: 'success',
        title: '✅ PDF Generado',
        text: 'La nómina ha sido descargada exitosamente',
        timer: 2000,
        confirmButtonColor: '#10b981'
      });

    } catch (error) {
      console.error('❌ Error viewing payroll PDF:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo generar el PDF'
      });
    }
  }

  generatePayrollPDF(payroll: any) {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    let yPos = 20;

    // Encabezado
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('ESTUDIANTINA TONANTZIN GUADALUPE', pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;

    doc.setFontSize(14);
    doc.text('NÓMINA GENERAL', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(payroll.contractName, pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    // Resumen
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Pago de contrato: $${payroll.contractAmount}`, 15, yPos);
    yPos += 6;
    doc.text(`Asistentes: ${payroll.attendees}`, 15, yPos);
    yPos += 6;
    doc.text(`Monto unitario: $${payroll.unitAmount}`, 15, yPos);
    yPos += 6;
    doc.text(`Fecha: ${payroll.validatedAt?.toDate ? payroll.validatedAt.toDate().toLocaleDateString('es-MX') : 'N/A'}`, 15, yPos);
    yPos += 10;

    // Totales
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL', 90, yPos);
    doc.text('BRUTO', 120, yPos);
    doc.text('IMPUESTO', 150, yPos);
    doc.text('NETO', 180, yPos);
    yPos += 6;

    doc.setFont('helvetica', 'normal');
    doc.text(`$${payroll.totalGross}`, 120, yPos);
    doc.text(`$${payroll.totalTax}`, 150, yPos);
    doc.text(`$${payroll.totalNet}`, 180, yPos);
    yPos += 12;

    // Tabla
    const tableX = 10;
    const colWidths = [12, 65, 18, 18, 18, 23, 23, 23];
    let currentX = tableX;

    // Encabezados
    doc.setFillColor(24, 157, 152);
    doc.rect(tableX, yPos, pageWidth - 20, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');

    doc.text('N.P.', currentX + 2, yPos + 5.5);
    currentX += colWidths[0];
    doc.text('Nombre', currentX + 2, yPos + 5.5);
    currentX += colWidths[1];
    doc.text('Nivel', currentX + 2, yPos + 5.5);
    currentX += colWidths[2];
    doc.text('IMP%', currentX + 2, yPos + 5.5);
    currentX += colWidths[3];
    doc.text('ASIS', currentX + 2, yPos + 5.5);
    currentX += colWidths[4];
    doc.text('BRUTO', currentX + 2, yPos + 5.5);
    currentX += colWidths[5];
    doc.text('IMP', currentX + 2, yPos + 5.5);
    currentX += colWidths[6];
    doc.text('NETO', currentX + 2, yPos + 5.5);

    yPos += 8;
    doc.setTextColor(0, 0, 0);

    // Datos
    let index = 1;
    payroll.employees.forEach((employee: any) => {
      if (yPos > pageHeight - 20) {
        doc.addPage();
        yPos = 20;
      }

      if (index % 2 === 0) {
        doc.setFillColor(245, 245, 245);
        doc.rect(tableX, yPos, pageWidth - 20, 6, 'F');
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);

      currentX = tableX;
      doc.text(index.toString(), currentX + 2, yPos + 4);
      currentX += colWidths[0];
      
      const nameLines = doc.splitTextToSize(employee.name, colWidths[1] - 4);
      doc.text(nameLines[0], currentX + 2, yPos + 4);
      currentX += colWidths[1];

      doc.text(employee.level.toString(), currentX + 2, yPos + 4);
      currentX += colWidths[2];

      doc.text(`${employee.taxPercentage}%`, currentX + 2, yPos + 4);
      currentX += colWidths[3];

      doc.text('1', currentX + 2, yPos + 4);
      currentX += colWidths[4];

      doc.text(`$${employee.gross}`, currentX + 2, yPos + 4);
      currentX += colWidths[5];

      doc.text(`$${employee.tax}`, currentX + 2, yPos + 4);
      currentX += colWidths[6];

      doc.text(`$${employee.net}`, currentX + 2, yPos + 4);

      yPos += 6;
      index++;
    });

    // Footer
    yPos = pageHeight - 15;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text('Estudiantina Tonantzin Guadalupe', pageWidth / 2, yPos, { align: 'center' });

    // Guardar (compatible con iOS)
    this.downloadPDF(doc, `Nomina_General_${payroll.contractName.replace(/\s/g, '_')}_${Date.now()}.pdf`);
  }

  // Helper para descargar PDFs compatible con iOS
  private downloadPDF(doc: any, filename: string) {
    try {
      // Detectar si es iOS/Safari
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      
      if (isIOS || isSafari) {
        // Método compatible con iOS
        const blob = doc.output('blob');
        const url = URL.createObjectURL(blob);
        
        // Crear enlace temporal
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        
        // Agregar al DOM, hacer click y remover
        document.body.appendChild(link);
        link.click();
        
        // Limpiar después de un delay
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }, 100);
      } else {
        // Método estándar para otros navegadores
        doc.save(filename);
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      // Intentar método alternativo
      try {
        const blob = doc.output('blob');
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      } catch (fallbackError) {
        console.error('Fallback method also failed:', fallbackError);
        Swal.fire({
          icon: 'error',
          title: 'Error al descargar PDF',
          text: 'No se pudo descargar el archivo. Intenta desde otro navegador.'
        });
      }
    }
  }

  goBack() {
    this.router.navigate(['/contract-distribution']);
  }
}
