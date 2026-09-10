import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { InstrumentMaintenance } from '../models/maintenance.model';

@Injectable({
  providedIn: 'root'
})
export class MaintenanceService {
  private collectionName = 'instrument-maintenances';

  constructor(private firestore: AngularFirestore) { }

  /**
   * Adds a new maintenance record to Firestore
   */
  async addMaintenance(maintenance: InstrumentMaintenance): Promise<void> {
    const id = this.firestore.createId();
    const newRecord = { ...maintenance, id };
    await this.firestore.collection(this.collectionName).doc(id).set(newRecord);
  }

  /**
   * Retrieves all maintenance records for a specific user
   */
  getMaintenancesForUser(userId: string): Observable<InstrumentMaintenance[]> {
    return this.firestore.collection(this.collectionName, ref => 
      ref.where('userId', '==', userId)
    ).valueChanges().pipe(
      map(records => {
        const maintenances = records as InstrumentMaintenance[];
        return maintenances.sort((a, b) => {
          const dateA = a.maintenanceDate?.toDate ? a.maintenanceDate.toDate().getTime() : new Date(a.maintenanceDate).getTime();
          const dateB = b.maintenanceDate?.toDate ? b.maintenanceDate.toDate().getTime() : new Date(b.maintenanceDate).getTime();
          return dateB - dateA;
        });
      })
    );
  }

  /**
   * Retrieves the latest maintenance record for a specific user
   */
  getLatestMaintenanceForUser(userId: string): Observable<InstrumentMaintenance | null> {
    return this.firestore.collection(this.collectionName, ref => 
      ref.where('userId', '==', userId)
    ).valueChanges().pipe(
      map(records => {
        if (!records || records.length === 0) return null;
        const maintenances = records as InstrumentMaintenance[];
        maintenances.sort((a, b) => {
          const dateA = a.maintenanceDate?.toDate ? a.maintenanceDate.toDate().getTime() : new Date(a.maintenanceDate).getTime();
          const dateB = b.maintenanceDate?.toDate ? b.maintenanceDate.toDate().getTime() : new Date(b.maintenanceDate).getTime();
          return dateB - dateA;
        });
        return maintenances[0];
      })
    );
  }

  /**
   * Retrieves ALL maintenance records in the system
   */
  getAllMaintenances(): Observable<InstrumentMaintenance[]> {
    return this.firestore.collection(this.collectionName).valueChanges() as Observable<InstrumentMaintenance[]>;
  }
}
