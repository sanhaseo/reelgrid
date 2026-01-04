import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { GameGridComponent } from './components/game-grid/game-grid.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, GameGridComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css' // Angular 17 default
})
export class AppComponent {
  title = 'CineGrid';
}
