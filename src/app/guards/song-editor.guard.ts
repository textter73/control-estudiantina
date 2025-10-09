import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class SongEditorGuard implements CanActivate {
  
  constructor(
    private afAuth: AngularFireAuth,
    private firestore: AngularFirestore,
    private router: Router
  ) {}

  canActivate(): Observable<boolean> {
    return this.afAuth.authState.pipe(
      switchMap(user => {
        if (!user) {
          this.router.navigate(['/']);
          return [false];
        }
        
        return this.firestore.collection('users').doc(user.uid).get().pipe(
          map(doc => {
            const userData = doc.data() as any;
            const canEdit = userData?.profiles?.includes('administrador') || 
                           userData?.profiles?.includes('editor-canciones');
            
            if (!canEdit) {
              this.router.navigate(['/dashboard']);
              return false;
            }
            
            return true;
          })
        );
      })
    );
  }
}