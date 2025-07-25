import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';

interface Document {
  ClientId: string;
  DocumentPath: string;
  OriginalFileName: string;
  UploadDateTime: string;
  FileSize: number;
  FileExtension: string;
  selected?: boolean;
}

@Component({
  selector: 'app-document-management',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  template: `
    <div class="document-management">
      <!-- Header -->
      <div class="header">
        <div class="company-info">
          <h1>MTD/SA Testing Firm</h1>
        </div>
        <div class="nav-tabs">
          <button class="tab-btn">TASKS</button>
          <button class="tab-btn active">DOCUMENTS</button>
        </div>
        <div class="user-info">
          <div class="user-text">
            <span class="user-name">Kay Draper</span>
            <span class="user-details">Firm TI, MTD/SA</span>
          </div>
          <div class="user-dropdown">KAY DRAPER ▼</div>
        </div>
      </div>

      <!-- Client Section -->
      <div class="client-section">
        <span class="client-label">Client:</span>
        <select class="client-dropdown" [(ngModel)]="selectedClientId" (ngModelChange)="onClientChange($event)">
          <option value="">Select Client</option>
          <option *ngFor="let client of clients" [value]="client.id">{{client.name}}</option>
        </select>
      </div>

      <!-- Content Area -->
      <div class="content">
        <!-- Sidebar -->
        <div class="sidebar">
          <div class="view-options">
            <button class="view-btn" [class.active]="currentView === 'folder'" (click)="setView('folder')">📁 FOLDER VIEW</button>
            <button class="view-btn" [class.active]="currentView === 'list'" (click)="setView('list')">📄 LIST VIEW</button>
          </div>
          
          <!-- Folder View -->
          <div class="folder-tree" *ngIf="currentView === 'folder'">
            <div class="folder-item-with-icon">
              <span class="folder-icon"> </span>
              <span class="folder-name">Kay Draper</span>
            </div>
          </div>
          
          <!-- List View -->
          <div class="folder-tree" *ngIf="currentView === 'list'">
            <h3>All Documents</h3>
            <ul class="folder-list">
              <li class="folder-item active">My Uploads</li>
              <li class="folder-item">Shared With Me</li>
            </ul>
          </div>
        </div>

        <!-- Main Content -->
        <div class="main-content">
          <!-- Toolbar (Only show in List View) -->
          <div class="toolbar" *ngIf="currentView === 'list'">
            <button class="toolbar-btn add-btn" (click)="openAddDialog()">
              <span class="btn-icon">⊕</span> Add
            </button>
            <button class="toolbar-btn" [disabled]="!hasSelectedDocuments" (click)="downloadSelectedFiles()">
              📥 Download
            </button>
            <button class="toolbar-btn" [disabled]="!hasSelectedDocuments" (click)="deleteSelectedFiles()">
              🗑️ Delete
            </button>
            
            <div class="search-container">
              <input type="text" placeholder="Search" class="search-input" [(ngModel)]="searchTerm" (ngModelChange)="applyFilters()">
            </div>
          </div>

          <!-- Time Filter -->
          <div class="time-filter">
            <select [(ngModel)]="timeFilter" (ngModelChange)="applyTimeFilter($event)">
              <option value="all">All Time ▼</option>
              <option value="2weeks">Last 2 Weeks</option>
              <option value="1month">Last Month</option>
              <option value="6months">Last 6 Months</option>
              <option value="1year">Last Year</option>
            </select>
          </div>

          <!-- Document Grid -->
          <div class="document-grid">
            <div class="grid-header">
              <div class="header-cell">
                <input type="checkbox" (change)="toggleSelectAll($event)">
              </div>
              <div class="header-cell">Name</div>
              <div class="header-cell">Associated Task</div>
              <div class="header-cell">Added By</div>
              <div class="header-cell">Modified ↓</div>
            </div>
            
            <div class="grid-row" *ngFor="let doc of filteredDocuments" [class.selected]="doc.selected">
              <div class="grid-cell">
                <input type="checkbox" [(ngModel)]="doc.selected">
              </div>
              <div class="grid-cell">
                <span class="file-icon">📝</span>
                <span class="file-name">{{doc.OriginalFileName}}</span>
              </div>
              <div class="grid-cell">-</div>
              <div class="grid-cell">{{getAddedBy(doc)}}</div>
              <div class="grid-cell">{{formatDate(doc.UploadDateTime)}}</div>
            </div>
          </div>

          <!-- Add Document Button (Bottom) - Only show in List View -->
          <button class="floating-add-btn" 
                  *ngIf="currentView === 'list'" 
                  (click)="openAddDialog()">
            <span class="btn-icon">+</span> ADD DOCUMENT
          </button>
        </div>
      </div>

      <!-- Add Document Dialog -->
      <div class="dialog-overlay" *ngIf="showAddDialog" (click)="closeAddDialog()">
        <div class="dialog" (click)="$event.stopPropagation()">
          <div class="dialog-header">
            <h2>Add Document</h2>
            <button class="close-btn" (click)="closeAddDialog()">✕</button>
          </div>
          
          <div class="dialog-content">
            <div class="upload-area" 
                 [class.dragover]="isDragOver"
                 (dragover)="onDragOver($event)"
                 (dragleave)="onDragLeave($event)"
                 (drop)="onDrop($event)">
              
              <p class="upload-text">Drag a File Here or</p>
              
              <div class="upload-buttons">
                <button class="upload-btn browse-btn" (click)="triggerFileInput()">
                  BROWSE FOR FILE ➤
                </button>
                <span class="or">or</span>
                <button class="upload-btn scan-btn">SCAN FROM DEVICE</button>
              </div>
              
              <p class="upload-options">- Or Add Files From -</p>
              
              <div class="cloud-options">
                <button class="cloud-btn google-drive">
                  <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMSA5TDE0IDEySDE2TDIxIDlMMTIgMloiIGZpbGw9IiM0Mjg1RjQiLz4KPHN2Zz4K" alt="Google Drive">
                  Google Drive
                </button>
                <button class="cloud-btn dropbox">
                  <span class="dropbox-icon">📦</span> Dropbox
                </button>
                <button class="cloud-btn box">
                  <span class="box-icon">📦</span> Box
                </button>
              </div>
              
              <input type="file" 
                     #fileInput 
                     style="display: none;" 
                     accept=".xls,.xlsx,.csv,.pdf,.png,.jpg,.jpeg"
                     (change)="onFileSelected($event)">
            </div>
            
            <!-- Selected File Display -->
            <div *ngIf="selectedFile" class="selected-file">
              <div class="file-info">
                <span class="file-icon">📄</span>
                <span class="file-name">{{selectedFile.name}}</span>
                <span class="file-size">({{formatFileSize(selectedFile.size)}})</span>
                <button class="remove-file-btn" 
                        *ngIf="!isUploading" 
                        (click)="removeSelectedFile()"
                        title="Remove file">×</button>
              </div>
              <div class="upload-progress" *ngIf="isUploading">
                <div class="progress-bar">
                  <div class="progress-fill" [style.width.%]="uploadProgress"></div>
                </div>
                <span class="progress-text">{{uploadProgress}}% complete</span>
              </div>
            </div>
            
            <div *ngIf="uploadMessage" class="message" [ngClass]="{'success': uploadMessageSuccess, 'error': !uploadMessageSuccess}">
              {{uploadMessage}}
            </div>
          </div>
          
          <div class="dialog-footer">
            <div class="dialog-footer-left">
              <button class="dialog-btn upload-btn-footer" 
                      [disabled]="!selectedFile || isUploading"
                      (click)="uploadFile()">
                {{isUploading ? 'UPLOADING...' : 'UPLOAD'}}
              </button>
              <button class="dialog-btn cancel-btn" (click)="closeAddDialog()">CANCEL</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .document-management {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      min-height: 100vh;
    }

    /* Header */
    .header {
      background: white;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 20px;
      height: 60px;
      border-bottom: 1px solid #e0e0e0;
    }

    .company-info h1 {
      font-size: 18px;
      font-weight: 500;
      margin: 0;
      color: #333;
    }

    .nav-tabs {
      display: flex;
      gap: 20px;
    }

    .tab-btn {
      background: none;
      border: none;
      padding: 10px 20px;
      font-weight: 500;
      color: #666;
      cursor: pointer;
      border-bottom: 3px solid transparent;
    }

    .tab-btn.active {
      color: #ff8c00;
      border-bottom-color: #ff8c00;
      font-weight: 700;
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 15px;
    }

    .user-text {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }

    .user-name {
      font-weight: 500;
      color: #333;
    }

    .user-details {
      font-size: 12px;
      color: #666;
    }

    .user-dropdown {
      background: #ff8c00;
      color: white;
      padding: 5px 10px;
      border-radius: 4px;
      font-size: 16px;
      cursor: pointer;
      white-space: nowrap;
    }

    /* Client Section */
    .client-section {
      background: white;
      padding: 15px 20px;
      border-bottom: 1px solid #e0e0e0;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .client-label {
      font-weight: 500;
      color: #333;
    }

    .client-dropdown {
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      background: white;
      min-width: 200px;
    }

    /* Content Layout */
    .content {
      display: flex;
      height: calc(100vh - 120px);
    }

    /* Sidebar */
    .sidebar {
      width: 300px;
      background: white;
      border-right: 1px solid #e0e0e0;
      padding: 20px;
      flex-shrink: 0;
    }

    .view-options {
      display: flex;
      flex-direction: row;
      gap: 10px;
      margin-bottom: 30px;
    }

    .view-btn {
      background: none;
      border: 1px solid #ddd;
      padding: 10px 8px;
      text-align: center;
      border-radius: 4px;
      cursor: pointer;
      flex: 1;
      font-size: 11px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
      font-weight: 700;
    }

    .view-btn.active {
      background: #ff8c00;
      color: white;
      border-color: #ff8c00;
    }

    .folder-tree {
      margin-top: 20px;
    }

    .folder-tree h3 {
      margin: 0 0 15px 0;
      font-size: 16px;
      color: #333;
    }

    .folder-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .folder-item {
      padding: 8px 0;
      color: #666;
      cursor: pointer;
    }

    .folder-item.active {
      color: #0066cc;
      font-weight: 500;
    }

    .folder-item-with-icon {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 0;
      color: #333;
      font-weight: 500;
    }

    .folder-icon {
      font-size: 16px;
    }

    .folder-name {
      font-size: 14px;
    }

    /* Main Content */
    .main-content {
      flex: 1;
      background: white;
      margin: 20px;
      border-radius: 4px;
      overflow: hidden;
      min-width: 0;
    }

    /* Toolbar */
    .toolbar {
      background: #ff8c00;
      padding: 15px 20px;
      display: flex;
      align-items: center;
      gap: 15px;
    }

    .toolbar-btn {
      background: none;
      border: none;
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 700;
    }

    .toolbar-btn:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    .toolbar-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .toolbar-btn:disabled:hover {
      background: none;
    }

    .add-btn {
      background: rgba(255, 255, 255, 0.2);
    }

    .search-container {
      margin-left: auto;
    }

    .search-input {
      padding: 8px 12px;
      border: none;
      border-radius: 4px;
      width: 200px;
    }

    /* Time Filter */
    .time-filter {
      padding: 15px 20px;
      border-bottom: 1px solid #e0e0e0;
    }

    .time-filter select {
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      background: white;
    }

    /* Document Grid */
    .document-grid {
      flex: 1;
      overflow-x: auto;
      min-width: 800px;
    }

    .grid-header {
      display: grid;
      grid-template-columns: 50px 2fr 160px 150px 180px;
      background: #f8f9fa;
      padding: 15px 20px;
      border-bottom: 1px solid #e0e0e0;
      font-weight: 500;
      color: #333;
    }

    .grid-row {
      display: grid;
      grid-template-columns: 50px 2fr 120px 150px 180px;
      padding: 15px 20px;
      border-bottom: 1px solid #f0f0f0;
      align-items: center;
    }

    .grid-row:hover {
      background: #f8f9fa;
    }

    .grid-row.selected {
      background: #e3f2fd;
    }

    .header-cell, .grid-cell {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .file-icon {
      margin-right: 8px;
    }

    .file-name {
      color: #0066cc;
      cursor: pointer;
    }

    /* Floating Add Button */
    .floating-add-btn {
      position: absolute;
      bottom: 30px;
      left: 30px;
      background: #ff8c00;
      color: white;
      border: none;
      padding: 15px 20px;
      border-radius: 25px;
      cursor: pointer;
      font-weight: 500;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }

    /* Dialog */
    .dialog-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .dialog {
      background: white;
      border-radius: 8px;
      width: 600px;
      max-width: 90vw;
      max-height: 90vh;
      overflow: hidden;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      border-bottom: 1px solid #e0e0e0;
    }

    .dialog-header h2 {
      margin: 0;
      font-size: 18px;
      color: #333;
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 18px;
      cursor: pointer;
      color: #666;
    }

    .dialog-content {
      padding: 30px;
    }

    .upload-area {
      border: 2px dashed #ddd;
      border-radius: 8px;
      padding: 40px;
      text-align: center;
      transition: all 0.3s ease;
    }

    .upload-area.dragover {
      border-color: #ff8c00;
      background: #fff8f0;
    }

    .upload-text {
      font-size: 16px;
      color: #666;
      margin-bottom: 20px;
    }

    .upload-buttons {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 15px;
      margin-bottom: 20px;
    }

    .upload-btn {
      padding: 12px 24px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 500;
    }

    .browse-btn {
      background: #ff8c00;
      color: white;
    }

    .scan-btn {
      background: #f0f0f0;
      color: #333;
      border: 1px solid #ddd;
    }

    .or {
      color: #666;
      font-style: italic;
    }

    .upload-options {
      color: #666;
      margin: 20px 0;
      font-size: 14px;
    }

    .cloud-options {
      display: flex;
      justify-content: center;
      gap: 15px;
    }

    .cloud-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 15px;
      border: 1px solid #ddd;
      border-radius: 4px;
      background: white;
      cursor: pointer;
      font-size: 14px;
    }

    .selected-file {
      margin-top: 20px;
      padding: 15px;
      background: #f8f9fa;
      border-radius: 4px;
    }

    .file-info {
      display: flex;
      align-items: center;
      gap: 8px;
      position: relative;
    }

    .remove-file-btn {
      background: #ff4444;
      color: white;
      border: none;
      border-radius: 50%;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 14px;
      font-weight: bold;
      margin-left: auto;
      transition: background-color 0.2s ease;
    }

    .remove-file-btn:hover {
      background: #cc3333;
    }

    .file-size {
      color: #666;
      font-size: 12px;
    }

    .upload-progress {
      margin-top: 10px;
    }

    .progress-bar {
      width: 100%;
      height: 8px;
      background: #e0e0e0;
      border-radius: 4px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: #ff8c00;
      transition: width 0.3s ease;
    }

    .progress-text {
      font-size: 12px;
      color: #666;
      margin-top: 5px;
      display: block;
    }

    .dialog-footer {
      display: flex;
      justify-content: flex-start;
      padding: 20px;
      border-top: 1px solid #e0e0e0;
      background: #f8f9fa;
    }

    .dialog-footer-left {
      display: flex;
      gap: 10px;
    }

    .dialog-btn {
      padding: 10px 20px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 500;
    }

    .cancel-btn {
      background: #f0f0f0;
      color: #333;
    }

    .upload-btn-footer {
      background: #ff8c00;
      color: white;
    }

    .upload-btn-footer:disabled {
      background: #ccc;
      cursor: not-allowed;
    }

    .message {
      margin-top: 15px;
      padding: 12px;
      border-radius: 4px;
      font-size: 14px;
    }

    .message.success {
      background: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
    }

    .message.error {
      background: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
    }
  `]
})
export class DocumentManagementComponent implements OnInit {
  documents: Document[] = [];
  filteredDocuments: Document[] = [];
  selectedClientId: string = '';
  searchTerm: string = '';
  timeFilter: string = 'all';
  showAddDialog: boolean = false;
  selectedFile: File | null = null;
  isDragOver: boolean = false;
  isUploading: boolean = false;
  uploadProgress: number = 0;
  uploadMessage: string = '';
  uploadMessageSuccess: boolean = false;
  currentView: 'folder' | 'list' = 'list'; // Default to list view

  get hasSelectedDocuments(): boolean {
    return this.filteredDocuments.some(doc => doc.selected);
  }

  clients = [
    { id: '22d99244c8d14adc85d3b2db004d4830', name: 'Kay Draper' },
    { id: '5678', name: 'Smith, John' },
    { id: '9012', name: 'Johnson, Maria' }
  ];

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.selectedClientId = '22d99244c8d14adc85d3b2db004d4830'; // Default client
    this.loadDocuments();
  }

  loadDocuments() {
    if (!this.selectedClientId) {
      this.documents = [];
      this.filteredDocuments = [];
      return;
    }

    this.http.get<Document[]>(`http://localhost:5119/api/document/documents?clientId=${this.selectedClientId}`)
      .subscribe({
        next: (docs) => {
          this.documents = docs;
          this.applyFilters();
        },
        error: (error) => {
          console.error('Error loading documents:', error);
          this.documents = [];
          this.filteredDocuments = [];
        }
      });
  }

  onClientChange(clientId: string) {
    this.selectedClientId = clientId;
    this.loadDocuments();
  }

  applyTimeFilter(filter: string) {
    this.timeFilter = filter;
    this.applyFilters();
  }

  setView(view: 'folder' | 'list') {
    this.currentView = view;
  }

  applyFilters() {
    let filtered = [...this.documents];

    // Apply search filter
    if (this.searchTerm) {
      filtered = filtered.filter(doc => 
        doc.OriginalFileName.toLowerCase().includes(this.searchTerm.toLowerCase())
      );
    }

    // Apply time filter
    if (this.timeFilter !== 'all') {
      const now = new Date();
      const cutoff = new Date();
      
      switch (this.timeFilter) {
        case '2weeks':
          cutoff.setDate(now.getDate() - 14);
          break;
        case '1month':
          cutoff.setMonth(now.getMonth() - 1);
          break;
        case '6months':
          cutoff.setMonth(now.getMonth() - 6);
          break;
        case '1year':
          cutoff.setFullYear(now.getFullYear() - 1);
          break;
      }
      
      filtered = filtered.filter(doc => new Date(doc.UploadDateTime) >= cutoff);
    }

    this.filteredDocuments = filtered;
  }

  toggleSelectAll(event: any) {
    const checked = event.target.checked;
    this.filteredDocuments.forEach(doc => doc.selected = checked);
  }

  getAddedBy(doc: Document): string {
    return doc.ClientId === this.selectedClientId ? 'Me' : 'Someone Else';
  }

  getClientName(clientId: string): string {
    const client = this.clients.find(c => c.id === clientId);
    return client ? client.name : 'Unknown Client';
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  openAddDialog() {
    this.showAddDialog = true;
    this.selectedFile = null;
    this.uploadMessage = '';
    this.uploadProgress = 0;
  }

  closeAddDialog() {
    this.showAddDialog = false;
    this.selectedFile = null;
    this.uploadMessage = '';
    this.uploadProgress = 0;
    this.isUploading = false;
  }

  removeSelectedFile() {
    this.selectedFile = null;
    this.uploadMessage = '';
    this.uploadProgress = 0;
    this.isUploading = false;
  }

  triggerFileInput() {
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fileInput?.click();
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      this.uploadMessage = '';
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.selectedFile = files[0];
      this.uploadMessage = '';
    }
  }

  uploadFile() {
    if (!this.selectedFile || !this.selectedClientId) {
      this.uploadMessage = 'Please select a file and client.';
      this.uploadMessageSuccess = false;
      return;
    }

    this.isUploading = true;
    this.uploadMessage = '';
    this.uploadProgress = 0;

    const formData = new FormData();
    formData.append('file', this.selectedFile);
    formData.append('clientId', this.selectedClientId);

    // Simulate progress
    const progressInterval = setInterval(() => {
      if (this.uploadProgress < 90) {
        this.uploadProgress += 10;
      }
    }, 200);

    this.http.post('http://localhost:5119/api/document/upload', formData).subscribe({
      next: (response: any) => {
        clearInterval(progressInterval);
        this.uploadProgress = 100;
        this.isUploading = false;
        this.uploadMessage = 'File uploaded successfully!';
        this.uploadMessageSuccess = true;
        
        // Reload documents and close dialog after a delay
        setTimeout(() => {
          this.loadDocuments();
          this.closeAddDialog();
        }, 1500);
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

  downloadSelectedFiles() {
    const selectedDocs = this.filteredDocuments.filter(doc => doc.selected);
    
    selectedDocs.forEach(doc => {
      // Create a download link for each selected file
      this.http.get(`http://localhost:5119/api/document/download/${encodeURIComponent(doc.OriginalFileName)}?clientId=${this.selectedClientId}`, {
        responseType: 'blob'
      }).subscribe({
        next: (blob: Blob) => {
          // Create download link
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = doc.OriginalFileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        },
        error: (error) => {
          console.error('Download error:', error);
          alert(`Failed to download ${doc.OriginalFileName}`);
        }
      });
    });
  }

  deleteSelectedFiles() {
    const selectedDocs = this.filteredDocuments.filter(doc => doc.selected);
    
    if (selectedDocs.length === 0) return;
    
    const confirmMessage = selectedDocs.length === 1 
      ? `Are you sure you want to delete "${selectedDocs[0].OriginalFileName}"?`
      : `Are you sure you want to delete ${selectedDocs.length} selected files?`;
    
    if (!confirm(confirmMessage)) return;
    
    // Delete files sequentially to avoid race conditions
    this.deleteFilesSequentially(selectedDocs, 0);
  }

  private deleteFilesSequentially(files: Document[], index: number) {
    if (index >= files.length) {
      // All files processed, reload documents
      this.loadDocuments();
      return;
    }

    const doc = files[index];
    this.http.delete(`http://localhost:5119/api/document/delete/${encodeURIComponent(doc.OriginalFileName)}?clientId=${this.selectedClientId}`)
      .subscribe({
        next: (response) => {
          console.log(`Deleted ${doc.OriginalFileName}`);
          // Continue with next file
          this.deleteFilesSequentially(files, index + 1);
        },
        error: (error) => {
          console.error('Delete error:', error);
          alert(`Failed to delete ${doc.OriginalFileName}`);
          // Continue with next file even if this one failed
          this.deleteFilesSequentially(files, index + 1);
        }
      });
  }
}
