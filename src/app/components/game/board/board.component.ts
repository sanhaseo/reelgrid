import { Component, Input, Output, EventEmitter, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Criteria } from '../../../services/movie.service';

@Component({
    selector: 'app-board',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './board.component.html',
    styleUrl: './board.component.css'
})
export class BoardComponent {
    @Input() rowCriteria: Criteria[] = [];
    @Input() colCriteria: Criteria[] = [];
    @Input() gridData: any[][] = [];
    @Input() cellTemplate!: TemplateRef<any>;
    @Input() isInteractive: boolean = true;

    @Output() cellClick = new EventEmitter<{ row: number, col: number }>();

    selectedCriteria: Criteria | null = null;
    showCriteriaModal = false;

    onCriteriaClick(c: Criteria): void {
        this.openCriteriaInfo(c);
    }

    openCriteriaInfo(criteria: Criteria): void {
        this.selectedCriteria = criteria;
        this.showCriteriaModal = true;
    }

    closeCriteriaModal(): void {
        this.showCriteriaModal = false;
        this.selectedCriteria = null;
    }

    getCriteriaDescription(c: Criteria): string {
        switch (c.type) {
            case 'title':
                return 'Based on the word count of the title.';
            case 'actor':
                return `The movie must feature ${c.label} in the cast.`;
            case 'director':
                return `The movie must be directed by ${c.label}.`;
            case 'company':
                return `Produced by ${c.label}.`;
            case 'box_office':
                return 'Worldwide box office revenue > threshold.';
            case 'year':
                return 'Primary release date within the decade.';
            case 'rating':
                return `US Certification Rating (MPAA) is ${c.value}.`;
            case 'runtime':
                return 'Total runtime including credits.';
            case 'keyword':
                return `Must include the keyword (or belongs to franchise): ${c.label}.`;
            default:
                return 'Standard criteria.';
        }
    }

    onCellClick(row: number, col: number): void {
        this.cellClick.emit({ row, col });
    }
}
