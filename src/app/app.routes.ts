import { Routes } from '@angular/router';
import { GameComponent } from './components/game/game.component';
import { PrivacyComponent } from './components/privacy/privacy.component';
import { TermsComponent } from './components/terms/terms.component';

export const routes: Routes = [
    { path: 'privacy', component: PrivacyComponent },
    { path: 'terms', component: TermsComponent },
    { path: '', component: GameComponent },
    { path: ':date', component: GameComponent }
];
