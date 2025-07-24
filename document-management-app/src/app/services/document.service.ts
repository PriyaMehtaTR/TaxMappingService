import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DocumentService {
  private apiUrl = 'http://localhost:5119/api/document'; // Update this to match your API URL

  constructor(private http: HttpClient) { }

  uploadDocument(file: File, clientId: string): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('clientId', clientId);

    return this.http.post(`${this.apiUrl}/upload`, formData);
  }

  getDocuments(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/documents`);
  }
}
