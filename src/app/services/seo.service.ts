import { Injectable } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { filter, map, mergeMap } from 'rxjs/operators';

@Injectable({
    providedIn: 'root'
})
export class SeoService {

    constructor(
        private titleService: Title,
        private metaService: Meta,
        private router: Router,
        private activatedRoute: ActivatedRoute
    ) { }

    init() {
        this.router.events.pipe(
            filter(event => event instanceof NavigationEnd),
            map(() => this.activatedRoute),
            map(route => {
                while (route.firstChild) route = route.firstChild;
                return route;
            }),
            filter(route => route.outlet === 'primary'),
            mergeMap(route => route.params)
        ).subscribe(params => {
            const date = params['date'];
            if (date) {
                this.updateMetaTags(
                    `ReelGrid - ${date}`,
                    `Play the ReelGrid movie trivia game for ${date}. Guess the movies based on actors, directors, genres, and more!`,
                    `reelgrid, movies, game, trivia, ${date}`
                );
            } else {
                this.updateMetaTags(
                    'ReelGrid - Daily Movie Trivia Game',
                    'Test your movie knowledge with ReelGrid, the daily movie trivia game! Guess movies connecting actors, directors, and genres.',
                    'reelgrid, movies, game, trivia, daily game, cinegrid'
                );
            }
        });
    }

    private updateMetaTags(title: string, description: string, keywords: string) {
        // Set Title
        this.titleService.setTitle(title);

        // Set standard meta tags
        this.metaService.updateTag({ name: 'description', content: description });
        this.metaService.updateTag({ name: 'keywords', content: keywords });
        this.metaService.updateTag({ name: 'author', content: 'ReelGrid' });

        // Set Open Graph tags
        this.metaService.updateTag({ property: 'og:title', content: title });
        this.metaService.updateTag({ property: 'og:description', content: description });
        this.metaService.updateTag({ property: 'og:type', content: 'website' });
        this.metaService.updateTag({ property: 'og:url', content: 'https://reelgridgame.com' + this.router.url });
        // You can also add an og:image tag if you have a default social share image
        // this.metaService.updateTag({ property: 'og:image', content: 'https://reelgridgame.com/assets/og-image.jpg' });

        // Set Twitter Card tags
        this.metaService.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
        this.metaService.updateTag({ name: 'twitter:title', content: title });
        this.metaService.updateTag({ name: 'twitter:description', content: description });
    }
}
