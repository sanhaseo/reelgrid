import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-game-status',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game-status.component.html',
  styleUrl: './game-status.component.css'
})
export class GameStatusComponent {
  @Input() guessesLeft = 10;
  @Input() isRegenerating = false;
  @Input() gameOver = false;
  @Input() boardNumber = ''; // Placeholder for now

  @Output() giveUp = new EventEmitter<void>();
  @Output() regenerate = new EventEmitter<void>();

  onGiveUp(): void {
    this.giveUp.emit();
  }

  onRegenerate(): void {
    this.regenerate.emit();
  }
}
