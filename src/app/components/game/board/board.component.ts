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
            case 'genre':
                return `The movie must be officially categorized under the ${c.label} genre on TMDB.`;
            case 'title':
                if (Array.isArray(c.value)) {
                    if (c.idValue === 'ends_with' || (c.id && c.id.startsWith('ends_with'))) {
                        return 'The movie title must end with one of the specified letters. Trailing punctuation is ignored.';
                    }
                    return 'The movie title must start with one of the specified letters. Leading articles like "A", "An", or "The" are ignored.';
                }
                return `The movie title must meet the word count requirement: ${c.label}.`;
            case 'actor':
                return `The movie must feature ${c.label} as a credited actor in the cast.`;
            case 'director':
                return `The movie must be directed by the specified filmmaker: ${c.label}.`;
            case 'company':
                return `The movie must be produced by the specified production company: ${c.label}.`;
            case 'box_office':
                return 'The movie\'s worldwide box office revenue must exceed the specified threshold.';
            case 'year':
                return 'The movie\'s primary theatrical release year must fall within the specified period.';
            case 'rating':
                return `The movie must have an official US Certification (MPAA rating) of ${c.value}.`;
            case 'runtime':
                return 'The movie\'s total runtime, including credits, must fall within the specified length.';
            case 'keyword':
                return `The movie must be associated with the specific keyword, theme, or franchise: ${c.label}.`;
            default:
                return 'The movie must meet the standard requirement for this category.';
        }
    }

    onCellClick(row: number, col: number): void {
        this.cellClick.emit({ row, col });
    }
}
