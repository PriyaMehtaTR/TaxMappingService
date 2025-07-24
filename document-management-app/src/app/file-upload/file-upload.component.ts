import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';

@Component({
  selector: 'app-file-upload',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  template: `
    <div class="container">
      <h1 class="title">Step 1 of 5: Upload spreadsheet</h1>
       <div class="client-id-section">
          <label for="clientId">Client ID:</label>
          <input type="text" 
                 id="clientId" 
                 [(ngModel)]="clientId" 
                 (ngModelChange)="onClientIdChange($event)"
                 placeholder="Enter Client ID"
                 class="client-input">
        </div>
      <div class="upload-section">
        <h3 class="section-title">Upload File</h3>
        <p class="file-info">Max file size is 20MB. Supported file types are .xls, .xlsx and .csv.</p>
        
        <div class="upload-area" 
             [class.dragover]="isDragOver"
             (dragover)="onDragOver($event)"
             (dragleave)="onDragLeave($event)"
             (drop)="onDrop($event)">
          
          <div class="upload-content">
            <span class="upload-text">Select "Add file" or drag file into this space.</span>
            <button type="button" class="add-file-btn" (click)="triggerFileInput()">
              <span class="plus-icon">+</span> Add file
            </button>
          </div>
          
          <input type="file" 
                 #fileInput 
                 style="display: none;" 
                 accept=".xls,.xlsx,.csv"
                 (change)="onFileSelected($event)">
        </div>
        
        <div *ngIf="uploadSuccess" class="success-message">
          <span class="success-icon">✓</span>
          <span class="success-text">Upload successful</span>
        </div>
        
        <div *ngIf="selectedFile" class="file-info-bar">
          <span class="file-name">{{ selectedFile.name }}</span>
          <div class="progress-section">
            <span class="progress-text">{{ uploadProgress }}% complete</span>
            <button class="remove-file" (click)="removeFile()" *ngIf="!isUploading">×</button>
          </div>
        </div>
        
        <div *ngIf="selectedFile" class="progress-bar">
          <div class="progress-fill" [style.width.%]="uploadProgress"></div>
        </div>
        
       
        
        <div *ngIf="uploadMessage" class="message" [ngClass]="{'success': uploadMessageSuccess, 'error': !uploadMessageSuccess}">
          {{ uploadMessage }}
        </div>
      </div>
    </div>
  `,
  styles: [`
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      background-color: #fff;
    }

    .title {
      font-size: 24px;
      font-weight: 400;
      margin-bottom: 30px;
      color: #333;
    }

    .upload-section {
      background: white;
    }

    .section-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 8px;
      color: #333;
    }

    .file-info {
      font-size: 14px;
      color: #666;
      margin-bottom: 20px;
    }

    .upload-area {
      border: 2px dashed #d1d5db;
      border-radius: 8px;
      padding: 40px;
      text-align: center;
      background-color: #fafafa;
      transition: all 0.3s ease;
      margin-bottom: 20px;
    }

    .upload-area:hover,
    .upload-area.dragover {
      border-color: #3b82f6;
      background-color: #f0f8ff;
    }

    .upload-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 15px;
    }

    .upload-text {
      font-size: 16px;
      color: #666;
    }

    .add-file-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background-color: #059669;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.3s;
    }

    .add-file-btn:hover {
      background-color: #047857;
    }

    .plus-icon {
      font-size: 16px;
      font-weight: bold;
    }

    .success-message {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
    }

    .success-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      background-color: #059669;
      color: white;
      border-radius: 50%;
      font-size: 12px;
      font-weight: bold;
    }

    .success-text {
      color: #059669;
      font-weight: 500;
    }

    .file-info-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }

    .file-name {
      font-weight: 500;
      color: #333;
    }

    .progress-section {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .progress-text {
      color: #666;
      font-size: 14px;
    }

    .remove-file {
      background: none;
      border: none;
      font-size: 18px;
      color: #666;
      cursor: pointer;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .remove-file:hover {
      background-color: #f3f4f6;
    }

    .progress-bar {
      width: 100%;
      height: 8px;
      background-color: #e5e7eb;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 20px;
    }

    .progress-fill {
      height: 100%;
      background-color: #3b82f6;
      transition: width 0.3s ease;
    }

    .client-id-section {
      margin-bottom: 20px;
    }

    .client-id-section label {
      display: block;
      margin-bottom: 5px;
      font-weight: 500;
      color: #333;
    }

    .client-input {
      width: 100%;
      max-width: 300px;
      padding: 10px 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 14px;
      transition: border-color 0.3s;
    }

    .client-input:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .upload-actions {
      margin-top: 20px;
    }

    .message {
      margin-top: 15px;
      padding: 12px;
      border-radius: 6px;
      font-size: 14px;
    }

    .message.success {
      background-color: #d1fae5;
      color: #065f46;
      border: 1px solid #a7f3d0;
    }

    .message.error {
      background-color: #fee2e2;
      color: #991b1b;
      border: 1px solid #fca5a5;
    }
  `]
})
export class FileUploadComponent {
  selectedFile: File | null = null;
  clientId: string = '';
  isDragOver: boolean = false;
  isUploading: boolean = false;
  uploadSuccess: boolean = false;
  uploadProgress: number = 0;
  uploadMessage: string = '';
  uploadMessageSuccess: boolean = false;

  constructor(private http: HttpClient) {}

  onClientIdChange(value: string): void {
    this.clientId = value;
    // If we have a file selected and client ID is entered, upload automatically
    if (this.selectedFile && value.trim() && !this.isUploading) {
      this.uploadFile();
    }
  }

  triggerFileInput(): void {
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fileInput?.click();
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    this.selectFile(file);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.selectFile(files[0]);
    }
  }

  selectFile(file: File): void {
    // Validate file type
    const allowedTypes = ['.xls', '.xlsx', '.csv'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!allowedTypes.includes(fileExtension)) {
      this.showMessage('Only .xls, .xlsx and .csv files are allowed.', false);
      return;
    }

    // Validate file size (20MB)
    if (file.size > 20 * 1024 * 1024) {
      this.showMessage('File size cannot exceed 20MB.', false);
      return;
    }

    this.selectedFile = file;
    this.uploadMessage = '';
    this.uploadSuccess = false;
    this.uploadProgress = 0;

    // Auto-upload if clientId is provided
    if (this.clientId.trim()) {
      this.uploadFile();
    } else {
      this.showMessage('Please enter a Client ID to proceed with upload.', false);
    }
  }

  removeFile(): void {
    this.selectedFile = null;
    this.uploadMessage = '';
    this.uploadSuccess = false;
    this.uploadProgress = 0;
    // Reset file input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  uploadFile(): void {
    if (!this.selectedFile || !this.clientId) {
      this.showMessage('Please select a file and enter a client ID.', false);
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
        this.showMessage('File uploaded successfully!', true);
        console.log('Upload response:', response);
      },
      error: (error) => {
        clearInterval(progressInterval);
        this.isUploading = false;
        this.uploadProgress = 0;
        console.error('Upload error:', error);
        
        if (error.status === 0) {
          this.showMessage('Cannot connect to backend server. Please make sure the backend is running on http://localhost:5119', false);
        } else {
          const errorMessage = error.error?.message || error.message || 'An error occurred during upload.';
          this.showMessage(errorMessage, false);
        }
      }
    });
  }

  private showMessage(message: string, success: boolean): void {
    this.uploadMessage = message;
    this.uploadMessageSuccess = success;
  }
}
