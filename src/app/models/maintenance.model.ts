export interface InstrumentMaintenance {
  id?: string;
  userId: string;
  userName: string;
  instrument: string;
  maintenanceDate: any; // Date | Timestamp
  description: string;
  cost: number;
  nextMaintenanceDate: any; // Date | Timestamp
  registeredBy: string;
  registeredAt: any;
}
