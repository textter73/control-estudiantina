import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { SongbookService } from '../../services/songbook.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-songbook',
  templateUrl: './songbook.component.html',
  styleUrls: ['./songbook.component.css']
})
export class SongbookComponent {
  title: string = '';
  composers: string = '';
  instrumentation: string = '';
  comments: string = '';
  structure: string = '';
  category: string = '';
  youtubeLink: string = '';
  status: string = '';

  categories = [
    'estudiantina',
    'popular',
    'canto de entrada',
    'señor ten piedad',
    'aleluya',
    'ofertorio',
    'santo',
    'coordero',
    'comunio',
    'canto de salida',
    'navidad',
    'cantos a maria'
  ];

  constructor(private router: Router, private songbookService: SongbookService) {}

  saveSong() {
    const song = {
      title: this.title,
      composers: this.composers,
      category: this.category,
      instrumentation: this.instrumentation,
      comments: this.comments,
      youtubeLink: this.youtubeLink,
      structure: this.structure,
      status: this.status
    };
    this.songbookService.addSong(song)
      .then(() => {
        Swal.fire({
          icon: 'success',
          title: '¡Canción guardada!',
          text: 'La canción se guardó exitosamente.'
        });
        this.title = '';
        this.composers = '';
        this.category = '';
        this.instrumentation = '';
        this.comments = '';
        this.youtubeLink = '';
        this.structure = '';
        this.status = '';
      })
      .catch(error => {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Error al guardar la canción: ' + error
        });
      });
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }
}
