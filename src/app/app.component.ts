import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { SeoService } from './services/seo.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css' // Angular 17 default
})
export class AppComponent {
  title = 'ReelGrid';

  constructor(private seoService: SeoService) {
    this.seoService.init();
  }
}
