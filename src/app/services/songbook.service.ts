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
}
