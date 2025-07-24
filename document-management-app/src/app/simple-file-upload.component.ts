import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';

@Component({
  selector: 'app-file-upload-simple',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  template: `
    <div style="max-width: 800px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
      <h1>Step 1 of 5: Upload spreadsheet</h1>
      
      <div>
        <h3>Upload File</h3>
        <p>Max file size is 20MB. Supported file types are .xls, .xlsx, and .csv.</p>
        
        <div style="border: 2px dashed #ccc; padding: 40px; text-align: center; margin: 20px 0; cursor: pointer;" 
             (click)="triggerFileInput()">
          <p>Select "Add file" or drag file into this space.</p>
          <button style="background: #059669; color: white; border: none; padding: 10px 20px; border-radius: 5px;" 
                  (click)="triggerFileInput()">
            + Add file
          </button>
          <input type="file" #fileInput style="display: none;" accept=".xls,.xlsx,.csv" (change)="onFileSelected($event)">
        </div>
        
        <div *ngIf="uploadSuccess" style="color: green; margin: 10px 0;">
          ✓ Upload successful
        </div>
        
        <div *ngIf="selectedFile" style="margin: 10px 0;">
          <p><strong>{{selectedFile.name}}</strong></p>
          <div style="background: #f0f0f0; height: 10px; border-radius: 5px;">
            <div style="background: #007bff; height: 100%; border-radius: 5px;" [style.width.%]="uploadProgress"></div>
          </div>
          <p>{{uploadProgress}}% complete</p>
        </div>
        
        <div style="margin: 20px 0;">
          <label>Client ID:</label><br>
          <input type="text" [(ngModel)]="clientId" placeholder="Enter Client ID" 
                 style="padding: 10px; border: 1px solid #ccc; border-radius: 5px; width: 300px;">
        </div>
        
        <button style="background: #007bff; color: white; border: none; padding: 12px 24px; border-radius: 5px; cursor: pointer;"
                [disabled]="!selectedFile || !clientId || isUploading"
                (click)="uploadFile()">
          {{isUploading ? 'Uploading...' : 'Upload Document'}}
        </button>
        
        <div *ngIf="uploadMessage" [style.color]="uploadMessageSuccess ? 'green' : 'red'" style="margin: 15px 0;">
          {{uploadMessage}}
        </div>
      </div>
    </div>
  `
})
export class SimpleFileUploadComponent {
  selectedFile: File | null = null;
  clientId: string = '';
  isUploading: boolean = false;
  uploadSuccess: boolean = false;
  uploadProgress: number = 0;
  uploadMessage: string = '';
  uploadMessageSuccess: boolean = false;

  constructor(private http: HttpClient) {}

  triggerFileInput(): void {
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fileInput?.click();
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      this.uploadMessage = '';
      this.uploadSuccess = false;
      this.uploadProgress = 0;
    }
  }

  uploadFile(): void {
    if (!this.selectedFile || !this.clientId) {
      this.uploadMessage = 'Please select a file and enter a client ID.';
      this.uploadMessageSuccess = false;
      return;
    }

    this.isUploading = true;
    this.uploadMessage = '';
    this.uploadProgress = 0;

    const formData = new FormData();
    formData.append('file', this.selectedFile);
    formData.append('clientId', this.clientId);

    // Simulate progress
    const progressInterval = setInterval(() => {
      if (this.uploadProgress < 90) {
        this.uploadProgress += 10;
      }
    }, 200);

    // Make the API call to backend
    this.http.post('http://localhost:5119/api/document/upload', formData).subscribe({
      next: (response: any) => {
        clearInterval(progressInterval);
        this.uploadProgress = 100;
        this.isUploading = false;
        this.uploadSuccess = true;
        this.uploadMessage = 'File uploaded successfully!';
        this.uploadMessageSuccess = true;
      },
      error: (error) => {
        clearInterval(progressInterval);
        this.isUploading = false;
        this.uploadProgress = 0;
        this.uploadMessage = 'Upload failed. Please try again.';
        this.uploadMessageSuccess = false;
      }
    });
  }
}
