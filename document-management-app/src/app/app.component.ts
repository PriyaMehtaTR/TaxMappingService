import { Component } from '@angular/core';
import { DocumentManagementComponent } from './document-management/document-management.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [DocumentManagementComponent],
  template: `
    <div>
      <app-document-management></app-document-management>
    </div>
  `,
  styles: [`
    div {
      margin: 0;
      padding: 0;
      height: 100vh;
    }
  `]
})
export class AppComponent {
  title = 'document-management-app';
}
