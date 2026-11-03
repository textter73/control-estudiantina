import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';

@Injectable({
  providedIn: 'root'
})
export class SongbookService {
  private collectionName = 'songs';

  constructor(private firestore: AngularFirestore) {}

  addSong(song: any) {
    return this.firestore.collection(this.collectionName).add(song);
  }

  getSongs() {
    return this.firestore.collection(this.collectionName).snapshotChanges();
  }

  updateSong(id: string, data: any) {
    return this.firestore.collection(this.collectionName).doc(id).update(data);
  }

  async batchUpdateOrderNumbers(updates: { id: string; orderNumber: number }[]): Promise<void> {
    if (!updates || updates.length === 0) return;
    const chunkSize = 450;
    for (let i = 0; i < updates.length; i += chunkSize) {
      const chunk = updates.slice(i, i + chunkSize);
      const batch = this.firestore.firestore.batch();
      for (const item of chunk) {
        const docRef = this.firestore.collection(this.collectionName).doc(item.id).ref;
        batch.update(docRef, { orderNumber: item.orderNumber });
      }
      await batch.commit();
    }
  }
}
