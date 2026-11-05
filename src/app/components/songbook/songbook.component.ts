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
  orderNumber: number | null = null;
  generalOrderNumber: number | null = null;
  status: string = '';
  allSongs: any[] = [];

  categories = [
    'estudiantina',
    'popular',
    'canto de entrada',
    'señor ten piedad',
    'aleluya',
    'ofertorio',
    'santo',
    'coordero',
    'comunión',
    'canto de salida',
    'navidad',
    'cantos a maria'
  ];

  constructor(private router: Router, private songbookService: SongbookService) {}

  ngOnInit() {
    this.songbookService.getSongs().subscribe((res: any) => {
      this.allSongs = res.map((doc: any) => doc.payload.doc.data());
      this.suggestGeneralOrderNumber();
      this.suggestCategoryOrderNumber();
    });
  }

  suggestGeneralOrderNumber() {
    const genNumbers = this.allSongs
      .map((s: any) => s?.generalOrderNumber)
      .filter((num: any) => num !== undefined && num !== null && !isNaN(Number(num)))
      .map((num: any) => Number(num));

    if (genNumbers.length > 0) {
      this.generalOrderNumber = Math.max(...genNumbers) + 1;
    } else {
      this.generalOrderNumber = this.allSongs.length + 1;
    }
  }

  onCategoryChange() {
    this.suggestCategoryOrderNumber();
  }

  suggestCategoryOrderNumber() {
    if (!this.category) {
      this.orderNumber = 1;
      return;
    }
    const catSongs = this.allSongs.filter((s: any) => s?.category === this.category);
    const catNumbers = catSongs
      .map((s: any) => s?.orderNumber)
      .filter((num: any) => num !== undefined && num !== null && !isNaN(Number(num)))
      .map((num: any) => Number(num));

    if (catNumbers.length > 0) {
      this.orderNumber = Math.max(...catNumbers) + 1;
    } else {
      this.orderNumber = catSongs.length + 1;
    }
  }

  saveSong() {
    const song: any = {
      title: this.title,
      orderNumber: (this.orderNumber != null && !isNaN(Number(this.orderNumber))) ? Number(this.orderNumber) : null,
      generalOrderNumber: (this.generalOrderNumber != null && !isNaN(Number(this.generalOrderNumber))) ? Number(this.generalOrderNumber) : null,
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
