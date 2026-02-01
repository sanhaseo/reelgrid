import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { GameComponent } from './components/game/game.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, GameComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css' // Angular 17 default
})
export class AppComponent {
  title = 'CineGrid';
}
