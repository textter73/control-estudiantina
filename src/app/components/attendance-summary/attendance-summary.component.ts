import { Component, OnInit } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Router } from '@angular/router';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-attendance-summary',
  templateUrl: './attendance-summary.component.html',
  styleUrls: ['./attendance-summary.component.css']
})
export class AttendanceSummaryComponent implements OnInit {
  allUsersRaw: any[] = [];
  users: any[] = [];
  attendances: any[] = [];
  filteredAttendances: any[] = [];
  summaryData: any[] = [];
  filteredSummaryData: any[] = [];
  userProfile: any = null;

  // Filtros y ordenamiento
  searchTerm: string = '';
  periodFilter: 'all' | '6months' | '3months' | 'month' | 'custom' = 'all';
  customStartDate: string = '';
  customEndDate: string = '';
  includeOnLeave: boolean = false;
  sortBy: 'participacion' | 'efectiva' | 'name' | 'faltas' = 'participacion';

  // KPIs ejecutivos del reporte
  groupKpis = {
    totalMembers: 0,
    totalSessions: 0,
    rehearsalSessions: 0,
    eventSessions: 0,
    massSessions: 0,
    avgParticipation: 0,
    avgEffective: 0,
    excellentCount: 0,
    atRiskCount: 0
  };

  // Modal de detalle por integrante
  selectedMemberDetail: any = null;

  constructor(
    private firestore: AngularFirestore,
    private afAuth: AngularFireAuth,
    private router: Router
  ) {}

  ngOnInit() {
    this.afAuth.authState.subscribe(async (user) => {
      if (user) {
        const userDoc = await this.firestore.collection('users').doc(user.uid).get().toPromise();
        this.userProfile = userDoc?.data();
        
        if (this.canViewSummary()) {
          this.loadData();
        } else {
          this.router.navigate(['/dashboard']);
        }
      } else {
        this.router.navigate(['/']);
      }
    });
  }

  canViewSummary(): boolean {
    return this.userProfile?.profiles?.includes('administrador') || 
           this.userProfile?.profiles?.includes('asistencia') || false;
  }

  /** Excluye la cuenta institucional Estudiantina Tonantzin Guadalupe */
  private isInstitutionalAccount(user: any): boolean {
    const cleanName = (user?.name || '').trim().toLowerCase();
    const cleanEmail = (user?.email || '').trim().toLowerCase();
    return (
      cleanName === 'estudiantina tonantzin guadalupe' ||
      cleanName === 'estudiantina tonantzin' ||
      cleanEmail === 'estudiantina@tonantzin.com'
    );
  }

  loadData() {
    this.firestore.collection('users').valueChanges({ idField: 'uid' }).subscribe((users: any[]) => {
      this.allUsersRaw = users || [];
      this.applyUserFilter();
      this.loadAttendances();
    });
  }

  applyUserFilter() {
    this.users = this.allUsersRaw.filter(user =>
      !user.deleted &&
      (this.includeOnLeave ? true : !user.onLeave) &&
      user.name &&
      !this.isInstitutionalAccount(user)
    );
  }

  loadAttendances() {
    this.firestore.collection('attendance').valueChanges({ idField: 'id' }).subscribe((attendances: any[]) => {
      this.attendances = (attendances || []).filter((att: any) => !att.status || att.status === 'completed');
      this.calculateSummary();
    });
  }

  private parseAttendanceDate(rawDate: any): Date {
    if (!rawDate) return new Date(0);
    if (rawDate.toDate && typeof rawDate.toDate === 'function') {
      return rawDate.toDate();
    }
    if (rawDate instanceof Date) {
      return rawDate;
    }
    if (typeof rawDate === 'string') {
      const clean = rawDate.split('T')[0];
      const parts = clean.split('-');
      if (parts.length === 3) {
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      }
    }
    return new Date(rawDate);
  }

  onFilterChange() {
    this.applyUserFilter();
    this.calculateSummary();
  }

  setPeriodFilter(period: 'all' | '6months' | '3months' | 'month' | 'custom') {
    this.periodFilter = period;
    this.calculateSummary();
  }

  get periodLabel(): string {
    switch (this.periodFilter) {
      case 'all': return 'Todo el historial';
      case '6months': return 'Últimos 6 meses';
      case '3months': return 'Últimos 3 meses';
      case 'month': return 'Mes actual';
      case 'custom':
        if (this.customStartDate || this.customEndDate) {
          return `${this.customStartDate || 'Inicio'} a ${this.customEndDate || 'Hoy'}`;
        }
        return 'Rango personalizado';
    }
  }

  private getFilteredAttendancesByPeriod(): any[] {
    const now = new Date();
    let startLimit: Date | null = null;
    let endLimit: Date | null = null;

    if (this.periodFilter === '6months') {
      startLimit = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
    } else if (this.periodFilter === '3months') {
      startLimit = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    } else if (this.periodFilter === 'month') {
      startLimit = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (this.periodFilter === 'custom') {
      if (this.customStartDate) {
        startLimit = this.parseAttendanceDate(this.customStartDate);
      }
      if (this.customEndDate) {
        endLimit = this.parseAttendanceDate(this.customEndDate);
        endLimit.setHours(23, 59, 59, 999);
      }
    }

    return this.attendances
      .filter(att => {
        const d = this.parseAttendanceDate(att.date);
        if (startLimit && d < startLimit) return false;
        if (endLimit && d > endLimit) return false;
        return true;
      })
      .sort((a, b) => this.parseAttendanceDate(b.date).getTime() - this.parseAttendanceDate(a.date).getTime());
  }

  calculateSummary() {
    this.filteredAttendances = this.getFilteredAttendancesByPeriod();

    // Contar sesiones por tipo en el periodo
    let rehearsalSessions = 0;
    let eventSessions = 0;
    let massSessions = 0;
    this.filteredAttendances.forEach(att => {
      if (att.type === 'ensayo') rehearsalSessions++;
      else if (att.type === 'evento') eventSessions++;
      else if (att.type === 'misa dominical') massSessions++;
    });

    this.summaryData = this.users.map(user => {
      let totalEvents = 0;
      let presente = 0;
      let escuela = 0;
      let enfermedad = 0;
      let falta = 0;

      let ensayosTotal = 0;
      let ensayosAsistidos = 0;
      let eventosTotal = 0;
      let eventosAsistidos = 0;
      let misasDominicales = 0;
      let misasAsistidas = 0;

      let consecutiveAbsences = 0;
      let countingConsecutive = true;
      const history: { date: Date, type: string, status: string }[] = [];

      this.filteredAttendances.forEach(attendance => {
        const userRecord = attendance.records?.find((record: any) => record.userId === user.uid);
        if (userRecord) {
          totalEvents++;
          const wasPresent = ['presente', 'escuela', 'enfermedad'].includes(userRecord.status);

          switch (userRecord.status) {
            case 'presente': presente++; break;
            case 'escuela': escuela++; break;
            case 'enfermedad': enfermedad++; break;
            case 'falta': falta++; break;
          }

          if (countingConsecutive) {
            if (userRecord.status === 'falta') {
              consecutiveAbsences++;
            } else {
              countingConsecutive = false;
            }
          }

          if (attendance.type === 'ensayo') {
            ensayosTotal++;
            if (wasPresent) ensayosAsistidos++;
          } else if (attendance.type === 'evento') {
            eventosTotal++;
            if (wasPresent) eventosAsistidos++;
          } else if (attendance.type === 'misa dominical') {
            misasDominicales++;
            if (wasPresent) misasAsistidas++;
          }

          history.push({
            date: this.parseAttendanceDate(attendance.date),
            type: attendance.type || 'ensayo',
            status: userRecord.status
          });
        }
      });

      const participacion = totalEvents > 0 ? Math.round(((presente + escuela + enfermedad) / totalEvents) * 100) : 0;
      const asistenciaEfectiva = totalEvents > 0 ? Math.round((presente / totalEvents) * 100) : 0;
      const ensayosPercentage = ensayosTotal > 0 ? Math.round((ensayosAsistidos / ensayosTotal) * 100) : 0;
      const eventosPercentage = eventosTotal > 0 ? Math.round((eventosAsistidos / eventosTotal) * 100) : 0;
      const misasPercentage = misasDominicales > 0 ? Math.round((misasAsistidas / misasDominicales) * 100) : 0;

      return {
        uid: user.uid,
        name: user.name,
        email: user.email,
        instrument: user.instrument || 'Sin instrumento',
        onLeave: !!user.onLeave,
        leaveReason: user.leaveReason || '',
        totalEvents,
        presente,
        escuela,
        enfermedad,
        falta,
        consecutiveAbsences,
        participacion,
        asistenciaEfectiva,
        ensayosTotal,
        ensayosAsistidos,
        ensayosPercentage,
        eventosTotal,
        eventosAsistidos,
        eventosPercentage,
        misasDominicales,
        misasAsistidas,
        misasPercentage,
        history
      };
    });

    // Calcular KPIs globales
    const totalMembers = this.summaryData.length;
    const sumPart = this.summaryData.reduce((acc, u) => acc + u.participacion, 0);
    const sumEff = this.summaryData.reduce((acc, u) => acc + u.asistenciaEfectiva, 0);
    const excellentCount = this.summaryData.filter(u => u.participacion >= 90).length;
    const atRiskCount = this.summaryData.filter(u => u.participacion < 60 || u.consecutiveAbsences >= 3).length;

    this.groupKpis = {
      totalMembers,
      totalSessions: this.filteredAttendances.length,
      rehearsalSessions,
      eventSessions,
      massSessions,
      avgParticipation: totalMembers > 0 ? Math.round(sumPart / totalMembers) : 0,
      avgEffective: totalMembers > 0 ? Math.round(sumEff / totalMembers) : 0,
      excellentCount,
      atRiskCount
    };

    this.applySearchAndSort();
  }

  setSortBy(criteria: 'participacion' | 'efectiva' | 'name' | 'faltas') {
    this.sortBy = criteria;
    this.applySearchAndSort();
  }

  applySearchAndSort() {
    let list = [...this.summaryData];

    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase().trim();
      list = list.filter(user =>
        (user.name && user.name.toLowerCase().includes(term)) ||
        (user.email && user.email.toLowerCase().includes(term)) ||
        (user.instrument && user.instrument.toLowerCase().includes(term))
      );
    }

    list.sort((a, b) => {
      if (this.sortBy === 'participacion') {
        return b.participacion - a.participacion || b.asistenciaEfectiva - a.asistenciaEfectiva;
      } else if (this.sortBy === 'efectiva') {
        return b.asistenciaEfectiva - a.asistenciaEfectiva || b.participacion - a.participacion;
      } else if (this.sortBy === 'faltas') {
        return b.falta - a.falta || b.consecutiveAbsences - a.consecutiveAbsences;
      } else {
        return (a.name || '').localeCompare(b.name || '');
      }
    });

    this.filteredSummaryData = list;
  }

  onSearchChange() {
    this.applySearchAndSort();
  }

  getStatusClass(percentage: number): string {
    if (percentage >= 90) return 'excellent';
    if (percentage >= 75) return 'good';
    if (percentage >= 60) return 'regular';
    return 'poor';
  }

  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  openMemberDetail(member: any) {
    this.selectedMemberDetail = member;
  }

  closeMemberDetail() {
    this.selectedMemberDetail = null;
  }

  getActivityLabel(type: string): string {
    switch (type) {
      case 'ensayo': return '🎵 Ensayo';
      case 'evento': return '🎉 Evento';
      case 'misa dominical': return '⛪ Misa Dominical';
      default: return type;
    }
  }

  getStatusBadgeText(status: string): string {
    switch (status) {
      case 'presente': return '✅ Presente';
      case 'escuela': return '🏫 Escuela';
      case 'enfermedad': return '🩺 Enfermedad';
      case 'falta': return '❌ Falta';
      default: return status;
    }
  }

  /**
   * Genera un Reporte General y Completo en PDF de todos los integrantes (omitiendo Estudiantina Tonantzin Guadalupe)
   */
  exportGeneralReportPDF() {
    try {
      const doc = new jsPDF('l', 'mm', 'a4'); // Horizontal para incluir el desglose completo
      const pageWidth = doc.internal.pageSize.getWidth();
      const nowStr = new Date().toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      // Encabezado oficial
      doc.setFillColor(24, 157, 152);
      doc.rect(0, 0, pageWidth, 24, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.text('ESTUDIANTINA TONANTZIN GUADALUPE', pageWidth / 2, 10, { align: 'center' });

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`REPORTE GENERAL Y COMPLETO DE ASISTENCIA DE INTEGRANTES (${this.periodLabel.toUpperCase()})`, pageWidth / 2, 18, { align: 'center' });

      // Resumen Ejecutivo
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(`Fecha de emisión: ${nowStr}`, 14, 31);
      doc.text(`Integrantes Evaluados: ${this.filteredSummaryData.length}`, 95, 31);
      doc.text(`Sesiones Registradas: ${this.groupKpis.totalSessions} (Ensayos: ${this.groupKpis.rehearsalSessions} | Eventos: ${this.groupKpis.eventSessions} | Misas: ${this.groupKpis.massSessions})`, 155, 31);

      doc.setFont('helvetica', 'normal');
      doc.text(
        `Promedio Grupal Participación: ${this.groupKpis.avgParticipation}%   |   Promedio Asistencia Efectiva: ${this.groupKpis.avgEffective}%   |   Excelencia (>=90%): ${this.groupKpis.excellentCount}   |   En Riesgo (<60% o 3+ faltas): ${this.groupKpis.atRiskCount}`,
        14,
        37
      );

      const tableRows = this.filteredSummaryData.map((u, idx) => [
        idx + 1,
        u.name + (u.onLeave ? ' (Permiso)' : ''),
        u.instrument || '-',
        u.totalEvents,
        `${u.participacion}%`,
        `${u.asistenciaEfectiva}%`,
        `${u.ensayosAsistidos}/${u.ensayosTotal} (${u.ensayosPercentage}%)`,
        `${u.eventosAsistidos}/${u.eventosTotal} (${u.eventosPercentage}%)`,
        `${u.misasAsistidas}/${u.misasDominicales} (${u.misasPercentage}%)`,
        u.presente,
        u.escuela,
        u.enfermedad,
        u.falta,
        u.consecutiveAbsences >= 3 ? `${u.consecutiveAbsences} !` : u.consecutiveAbsences
      ]);

      (doc as any).autoTable({
        startY: 42,
        head: [[
          '#',
          'Integrante',
          'Instrumento',
          'Total',
          '% Part.',
          '% Efect.',
          'Ensayos',
          'Eventos',
          'Misas Dom.',
          'Pres.',
          'Esc.',
          'Salud',
          'Faltas',
          'Racha'
        ]],
        body: tableRows,
        theme: 'grid',
        headStyles: {
          fillColor: [24, 157, 152],
          textColor: 255,
          fontStyle: 'bold',
          halign: 'center',
          fontSize: 8
        },
        styles: {
          fontSize: 7.8,
          cellPadding: 2,
          halign: 'center',
          valign: 'middle'
        },
        columnStyles: {
          0: { cellWidth: 8 },
          1: { halign: 'left', cellWidth: 48, fontStyle: 'bold' },
          2: { halign: 'left', cellWidth: 25 },
          3: { cellWidth: 12 },
          4: { cellWidth: 16, fontStyle: 'bold' },
          5: { cellWidth: 16 },
          6: { cellWidth: 28 },
          7: { cellWidth: 28 },
          8: { cellWidth: 28 },
          9: { cellWidth: 13 },
          10: { cellWidth: 13 },
          11: { cellWidth: 13 },
          12: { cellWidth: 14, fontStyle: 'bold' },
          13: { cellWidth: 14 }
        },
        didParseCell: (data: any) => {
          if (data.section === 'body') {
            const member = this.filteredSummaryData[data.row.index];
            if (!member) return;
            if (data.column.index === 4) {
              if (member.participacion >= 90) {
                data.cell.styles.fillColor = [220, 252, 231];
                data.cell.styles.textColor = [22, 101, 52];
              } else if (member.participacion < 60) {
                data.cell.styles.fillColor = [254, 226, 226];
                data.cell.styles.textColor = [153, 27, 27];
              }
            }
            if (data.column.index === 12 && member.falta > 0) {
              data.cell.styles.textColor = [220, 38, 38];
            }
            if (data.column.index === 13 && member.consecutiveAbsences >= 3) {
              data.cell.styles.fillColor = [254, 226, 226];
              data.cell.styles.textColor = [153, 27, 27];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        }
      });

      const dateSuffix = new Date().toISOString().split('T')[0];
      const fileName = `Reporte_General_Asistencia_Estudiantina_${dateSuffix}.pdf`;
      doc.save(fileName);

      Swal.fire({
        icon: 'success',
        title: 'Reporte PDF descargado',
        text: `Se generó "${fileName}" con ${this.filteredSummaryData.length} integrantes.`,
        timer: 2500,
        showConfirmButton: false
      });
    } catch (error) {
      console.error('Error al generar PDF de asistencia:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo generar el reporte PDF.'
      });
    }
  }

  /**
   * Exporta el Reporte General y Completo en formato CSV (compatible con Excel con codificación UTF-8)
   */
  exportGeneralReportCSV() {
    const headers = [
      'Posicion',
      'Integrante',
      'Instrumento',
      'Correo',
      'Total Actividades',
      '% Participacion',
      '% Asistencia Efectiva',
      'Ensayos Asistidos',
      'Ensayos Totales',
      '% Ensayos',
      'Eventos Asistidos',
      'Eventos Totales',
      '% Eventos',
      'Misas Asistidas',
      'Misas Totales',
      '% Misas',
      'Presente',
      'Permiso Escuela',
      'Justificado Salud',
      'Faltas',
      'Faltas Consecutivas Actuales'
    ];

    const escapeCsv = (val: any) => {
      const str = String(val ?? '').replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = this.filteredSummaryData.map((u, idx) => [
      idx + 1,
      u.name,
      u.instrument || '',
      u.email || '',
      u.totalEvents,
      `${u.participacion}%`,
      `${u.asistenciaEfectiva}%`,
      u.ensayosAsistidos,
      u.ensayosTotal,
      `${u.ensayosPercentage}%`,
      u.eventosAsistidos,
      u.eventosTotal,
      `${u.eventosPercentage}%`,
      u.misasAsistidas,
      u.misasDominicales,
      `${u.misasPercentage}%`,
      u.presente,
      u.escuela,
      u.enfermedad,
      u.falta,
      u.consecutiveAbsences
    ]);

    const csvContent = '\uFEFF' + [
      headers.map(escapeCsv).join(','),
      ...rows.map(r => r.map(escapeCsv).join(','))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateSuffix = new Date().toISOString().split('T')[0];
    link.href = url;
    link.setAttribute('download', `Reporte_General_Asistencia_Estudiantina_${dateSuffix}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}