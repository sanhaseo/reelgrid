import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

interface CalendarDay {
  dateStr: string;
  dayNum: number;
  isAvailable: boolean;
  isPadding: boolean;
  status?: 'finished' | 'in-progress';
  score?: number;
}

@Component({
  selector: 'app-archive-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './archive-modal.component.html',
  styleUrl: './archive-modal.component.css'
})
export class ArchiveModalComponent implements OnChanges {
  @Input() show = false;
  @Input() archiveDates: string[] = [];
  @Input() activeBoardDate = '';

  @Output() close = new EventEmitter<void>();
  @Output() dateSelected = new EventEmitter<string>();

  currentMonthStr = '';
  currentMonth = 0;
  currentYear = 0;
  calendarDays: CalendarDay[] = [];
  weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  constructor(private router: Router) { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['show'] && this.show) {
      this.initCalendar();
    }
  }

  initCalendar(): void {
    const refDateStr = this.activeBoardDate || (this.archiveDates.length > 0 ? this.archiveDates[0] : new Date().toISOString().split('T')[0]);
    let d = new Date(`${refDateStr}T00:00:00`);
    if (isNaN(d.getTime())) d = new Date();
    this.currentMonth = d.getMonth();
    this.currentYear = d.getFullYear();
    this.generateCalendar();
  }

  previousMonth(): void {
    if (this.currentMonth === 0) {
      this.currentMonth = 11;
      this.currentYear--;
    } else {
      this.currentMonth--;
    }
    this.generateCalendar();
  }

  nextMonth(): void {
    if (this.currentMonth === 11) {
      this.currentMonth = 0;
      this.currentYear++;
    } else {
      this.currentMonth++;
    }
    this.generateCalendar();
  }

  generateCalendar(): void {
    this.calendarDays = [];

    const firstDayOfMonth = new Date(this.currentYear, this.currentMonth, 1);
    const lastDayOfMonth = new Date(this.currentYear, this.currentMonth + 1, 0);

    this.currentMonthStr = firstDayOfMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

    // Padding days before the 1st
    const startingDayOfWeek = firstDayOfMonth.getDay();
    for (let i = 0; i < startingDayOfWeek; i++) {
      this.calendarDays.push({ dateStr: '', dayNum: 0, isAvailable: false, isPadding: true });
    }

    // Days in the month
    const numDays = lastDayOfMonth.getDate();
    for (let i = 1; i <= numDays; i++) {
      const monthStr = (this.currentMonth + 1).toString().padStart(2, '0');
      const dayStr = i.toString().padStart(2, '0');
      const dateStr = `${this.currentYear}-${monthStr}-${dayStr}`;

      const isAvailable = this.archiveDates.includes(dateStr);
      let status: 'finished' | 'in-progress' | undefined = undefined;
      let score: number | undefined = undefined;

      if (isAvailable) {
        // Check local storage for progress
        const saved = localStorage.getItem(`reelgrid_state_v1_${dateStr}`);
        if (saved) {
          try {
            const state = JSON.parse(saved);
            const grid = state.grid || [];
            let correctCount = 0;
            grid.forEach((row: any[]) => {
              row.forEach((cell: any) => {
                if (cell) {
                  correctCount++;
                }
              });
            });
            score = correctCount;
            // A game is in progress if guesses are used (guessesLeft < 10) or correctly guessed
            if (state.gameOver) {
              status = 'finished';
            } else if (state.guessesLeft < 10 || score > 0) {
              status = 'in-progress';
            }
          } catch (e) { }
        }
      }

      this.calendarDays.push({
        dateStr,
        dayNum: i,
        isAvailable,
        isPadding: false,
        status,
        score
      });
    }

    // Add trailing padding to make it a fixed 6 rows (42 days)
    while (this.calendarDays.length < 42) {
      this.calendarDays.push({ dateStr: '', dayNum: 0, isAvailable: false, isPadding: true });
    }
  }

  onClose(): void {
    this.close.emit();
  }

  onDateSelect(day: CalendarDay): void {
    if (day.isAvailable && !day.isPadding) {
      this.router.navigate(['/', day.dateStr]);
      this.close.emit();
    }
  }
}
