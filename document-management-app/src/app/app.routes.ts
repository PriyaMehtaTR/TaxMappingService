import { Routes } from '@angular/router';
import { FileUploadComponent } from './file-upload/file-upload.component';

export const routes: Routes = [
  { path: '', component: FileUploadComponent },
  { path: 'upload', component: FileUploadComponent },
  { path: '**', redirectTo: '' }
];
