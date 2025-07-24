using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace DMS.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DocumentController : ControllerBase
    {
        private readonly ILogger<DocumentController> _logger;
        private readonly string _uploadsPath;
        private readonly string _dataPath;

        public DocumentController(ILogger<DocumentController> logger)
        {
            _logger = logger;

            // Get the current directory (which should be C:\Geek2025\Backend\DMS when running from Visual Studio)
            var currentDir = Directory.GetCurrentDirectory();

            _uploadsPath = Path.Combine(currentDir, "Uploads");
            _dataPath = Path.Combine(currentDir, "Data");

            // Log the paths for debugging
            _logger.LogInformation($"Current Directory: {currentDir}");
            _logger.LogInformation($"Uploads Path: {_uploadsPath}");
            _logger.LogInformation($"Data Path: {_dataPath}");

            // Ensure directories exist
            Directory.CreateDirectory(_uploadsPath);
            Directory.CreateDirectory(_dataPath);
        }

        [HttpPost("upload")]
        public async Task<IActionResult> UploadDocument([FromForm] IFormFile file, [FromForm] string clientId)
        {
            try
            {
                if (file == null || file.Length == 0)
                {
                    return BadRequest("No file uploaded.");
                }

                // Validate file type
                var allowedExtensions = new[] { ".xls", ".xlsx", ".csv", ".pdf", ".png", ".jpg", ".jpeg" };
                var fileExtension = Path.GetExtension(file.FileName).ToLowerInvariant();

                if (!allowedExtensions.Contains(fileExtension))
                {
                    return BadRequest("Only .xls, .xlsx, .csv, .pdf, .png, .jpg, and .jpeg files are allowed.");
                }

                // Validate file size (20MB max)
                if (file.Length > 20 * 1024 * 1024)
                {
                    return BadRequest("File size cannot exceed 20MB.");
                }

                // Generate unique filename
                var fileName = Guid.NewGuid() + fileExtension;
                var filePath = Path.Combine(_uploadsPath, fileName);

                // Save file
                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                // Create document record
                var documentRecord = new
                {
                    ClientId = clientId,
                    DocumentPath = filePath,
                    OriginalFileName = file.FileName,
                    UploadDateTime = DateTime.UtcNow,
                    FileSize = file.Length,
                    FileExtension = fileExtension
                };

                // Save to JSON file
                await SaveDocumentRecord(documentRecord);

                _logger.LogInformation($"File uploaded successfully: {file.FileName}");

                return Ok(new
                {
                    Message = "File uploaded successfully",
                    FileName = file.FileName,
                    ClientId = clientId,
                    UploadDateTime = documentRecord.UploadDateTime
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error uploading file");
                return StatusCode(500, "An error occurred while uploading the file.");
            }
        }

        [HttpGet("documents")]
        public async Task<IActionResult> GetDocuments([FromQuery] string? clientId = null)
        {
            try
            {
                var documentsFilePath = Path.Combine(_dataPath, "documents.json");

                if (!System.IO.File.Exists(documentsFilePath))
                {
                    return Ok(new List<object>());
                }

                var jsonContent = await System.IO.File.ReadAllTextAsync(documentsFilePath);
                var documents = JsonSerializer.Deserialize<List<JsonElement>>(jsonContent);

                if (documents == null)
                {
                    return Ok(new List<object>());
                }

                // Filter by clientId if provided
                if (!string.IsNullOrEmpty(clientId))
                {
                    var filteredDocuments = documents.Where(doc =>
                    {
                        if (doc.TryGetProperty("ClientId", out var clientIdProperty))
                        {
                            return clientIdProperty.GetString()?.Equals(clientId, StringComparison.OrdinalIgnoreCase) == true;
                        }
                        return false;
                    }).ToList();

                    return Ok(filteredDocuments);
                }

                return Ok(documents);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving documents");
                return StatusCode(500, "An error occurred while retrieving documents.");
            }
        }

        [HttpGet("download/{fileName}")]
        public async Task<IActionResult> DownloadDocument(string fileName, [FromQuery] string clientId)
        {
            try
            {
                // Find the document in JSON file
                var documentsFilePath = Path.Combine(_dataPath, "documents.json");

                if (!System.IO.File.Exists(documentsFilePath))
                {
                    return NotFound("Document not found.");
                }

                var jsonContent = await System.IO.File.ReadAllTextAsync(documentsFilePath);
                var documents = JsonSerializer.Deserialize<List<JsonElement>>(jsonContent);

                if (documents == null)
                {
                    return NotFound("Document not found.");
                }

                // Find the specific document
                var document = documents.FirstOrDefault(doc =>
                {
                    if (doc.TryGetProperty("OriginalFileName", out var fileNameProperty) &&
                        doc.TryGetProperty("ClientId", out var clientIdProperty))
                    {
                        return fileNameProperty.GetString() == fileName &&
                               clientIdProperty.GetString()?.Equals(clientId, StringComparison.OrdinalIgnoreCase) == true;
                    }
                    return false;
                });

                if (document.ValueKind == JsonValueKind.Undefined)
                {
                    return NotFound("Document not found.");
                }

                // Get the file path
                if (!document.TryGetProperty("DocumentPath", out var pathProperty))
                {
                    return NotFound("Document path not found.");
                }

                var filePath = pathProperty.GetString();
                if (string.IsNullOrEmpty(filePath) || !System.IO.File.Exists(filePath))
                {
                    return NotFound("Physical file not found.");
                }

                // Return file for download
                var fileBytes = await System.IO.File.ReadAllBytesAsync(filePath);
                var contentType = GetContentType(fileName);

                return File(fileBytes, contentType, fileName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error downloading file");
                return StatusCode(500, "An error occurred while downloading the file.");
            }
        }

        [HttpDelete("delete/{fileName}")]
        public async Task<IActionResult> DeleteDocument(string fileName, [FromQuery] string clientId)
        {
            try
            {
                _logger.LogInformation($"Attempting to delete document: {fileName} for client: {clientId}");

                // Find and remove the document from JSON file
                var documentsFilePath = Path.Combine(_dataPath, "documents.json");

                if (!System.IO.File.Exists(documentsFilePath))
                {
                    _logger.LogWarning($"Documents file not found: {documentsFilePath}");
                    return NotFound("Document not found.");
                }

                var jsonContent = await System.IO.File.ReadAllTextAsync(documentsFilePath);
                var documents = JsonSerializer.Deserialize<List<JsonElement>>(jsonContent);

                if (documents == null)
                {
                    _logger.LogWarning("No documents found in JSON file");
                    return NotFound("Document not found.");
                }

                // Find the specific document
                var documentIndex = -1;
                JsonElement documentToDelete = default;

                for (int i = 0; i < documents.Count; i++)
                {
                    var doc = documents[i];
                    if (doc.TryGetProperty("OriginalFileName", out var fileNameProperty) &&
                        doc.TryGetProperty("ClientId", out var clientIdProperty))
                    {
                        if (fileNameProperty.GetString() == fileName &&
                            clientIdProperty.GetString()?.Equals(clientId, StringComparison.OrdinalIgnoreCase) == true)
                        {
                            documentIndex = i;
                            documentToDelete = doc;
                            break;
                        }
                    }
                }

                if (documentIndex == -1)
                {
                    _logger.LogWarning($"Document not found in JSON: {fileName} for client: {clientId}");
                    return NotFound("Document not found.");
                }

                // Get the file path and delete physical file
                var physicalFileDeleted = false;
                if (documentToDelete.TryGetProperty("DocumentPath", out var pathProperty))
                {
                    var filePath = pathProperty.GetString();
                    if (!string.IsNullOrEmpty(filePath))
                    {
                        if (System.IO.File.Exists(filePath))
                        {
                            try
                            {
                                System.IO.File.Delete(filePath);
                                physicalFileDeleted = true;
                                _logger.LogInformation($"Physical file deleted successfully: {filePath}");
                            }
                            catch (Exception fileEx)
                            {
                                _logger.LogError(fileEx, $"Failed to delete physical file: {filePath}");
                            }
                        }
                        else
                        {
                            _logger.LogWarning($"Physical file not found: {filePath}");
                        }
                    }
                    else
                    {
                        _logger.LogWarning($"Document path is empty for: {fileName}");
                    }
                }

                // Remove from JSON even if physical file deletion failed
                documents.RemoveAt(documentIndex);

                // Save updated JSON
                var options = new JsonSerializerOptions
                {
                    WriteIndented = true
                };
                var updatedJsonContent = JsonSerializer.Serialize(documents, options);
                await System.IO.File.WriteAllTextAsync(documentsFilePath, updatedJsonContent);

                _logger.LogInformation($"Document metadata removed from JSON: {fileName}");

                return Ok(new
                {
                    Message = "Document deleted successfully",
                    FileName = fileName,
                    PhysicalFileDeleted = physicalFileDeleted
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error deleting document: {fileName}");
                return StatusCode(500, "An error occurred while deleting the file.");
            }
        }

        [HttpGet("stream")]
        public async Task<IActionResult> StreamDocument([FromQuery] string clientId, [FromQuery] string filePath)
        {
            try
            {
                if (string.IsNullOrEmpty(clientId))
                {
                    return BadRequest("ClientId is required.");
                }

                if (string.IsNullOrEmpty(filePath))
                {
                    return BadRequest("FilePath is required.");
                }

                filePath = "C:\\Projects\\GeekSprint2025\\Backend\\DMS\\Uploads\\" + filePath;
                _logger.LogInformation($"Streaming document for client: {clientId}, filePath: {filePath}");

                // Find the document in JSON file to verify it belongs to the client
                var documentsFilePath = Path.Combine(_dataPath, "documents.json");

                if (!System.IO.File.Exists(documentsFilePath))
                {
                    return NotFound("Document registry not found.");
                }

                var jsonContent = await System.IO.File.ReadAllTextAsync(documentsFilePath);
                var documents = JsonSerializer.Deserialize<List<JsonElement>>(jsonContent);

                if (documents == null)
                {
                    return NotFound("No documents found.");
                }

                // Verify the document exists and belongs to the specified client
                var document = documents.FirstOrDefault(doc =>
                {
                    if (doc.TryGetProperty("ClientId", out var clientIdProperty) &&
                        doc.TryGetProperty("DocumentPath", out var pathProperty))
                    {
                        var docClientId = clientIdProperty.GetString();
                        var docPath = pathProperty.GetString();

                        return docClientId?.Equals(clientId, StringComparison.OrdinalIgnoreCase) == true &&
                               docPath?.Equals(filePath, StringComparison.OrdinalIgnoreCase) == true;
                    }
                    return false;
                });

                if (document.ValueKind == JsonValueKind.Undefined)
                {
                    return NotFound("Document not found or access denied.");
                }

                // Check if physical file exists
                if (!System.IO.File.Exists(filePath))
                {
                    return NotFound("Physical file not found.");
                }

                // Get file info for response headers
                var fileInfo = new FileInfo(filePath);
                var fileName = document.TryGetProperty("OriginalFileName", out var originalNameProperty)
                    ? originalNameProperty.GetString()
                    : Path.GetFileName(filePath);

                var contentType = GetContentType(fileName ?? Path.GetFileName(filePath));

                // Return file stream
                var fileStream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read);

                _logger.LogInformation($"Successfully streaming file: {fileName} for client: {clientId}");

                return File(fileStream, contentType, fileName, enableRangeProcessing: true);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error streaming document for client: {clientId}, filePath: {filePath}");
                return StatusCode(500, "An error occurred while streaming the file.");
            }
        }

        [HttpGet("stream-by-name")]
        public async Task<IActionResult> StreamDocumentByName([FromQuery] string clientId, [FromQuery] string fileName)
        {
            try
            {
                if (string.IsNullOrEmpty(clientId))
                {
                    return BadRequest("ClientId is required.");
                }

                if (string.IsNullOrEmpty(fileName))
                {
                    return BadRequest("FileName is required.");
                }

                _logger.LogInformation($"Streaming document by name for client: {clientId}, fileName: {fileName}");

                // Find the document in JSON file
                var documentsFilePath = Path.Combine(_dataPath, "documents.json");

                if (!System.IO.File.Exists(documentsFilePath))
                {
                    return NotFound("Document registry not found.");
                }

                var jsonContent = await System.IO.File.ReadAllTextAsync(documentsFilePath);
                var documents = JsonSerializer.Deserialize<List<JsonElement>>(jsonContent);

                if (documents == null)
                {
                    return NotFound("No documents found.");
                }

                // Find the specific document by original filename and client ID
                var document = documents.FirstOrDefault(doc =>
                {
                    if (doc.TryGetProperty("OriginalFileName", out var fileNameProperty) &&
                        doc.TryGetProperty("ClientId", out var clientIdProperty))
                    {
                        return fileNameProperty.GetString() == fileName &&
                               clientIdProperty.GetString()?.Equals(clientId, StringComparison.OrdinalIgnoreCase) == true;
                    }
                    return false;
                });

                if (document.ValueKind == JsonValueKind.Undefined)
                {
                    return NotFound("Document not found or access denied.");
                }

                // Get the file path
                if (!document.TryGetProperty("DocumentPath", out var pathProperty))
                {
                    return NotFound("Document path not found.");
                }

                var filePath = pathProperty.GetString();
                if (string.IsNullOrEmpty(filePath) || !System.IO.File.Exists(filePath))
                {
                    return NotFound("Physical file not found.");
                }

                // Get content type
                var contentType = GetContentType(fileName);

                // Return file stream
                var fileStream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read);

                _logger.LogInformation($"Successfully streaming file: {fileName} for client: {clientId}");

                return File(fileStream, contentType, fileName, enableRangeProcessing: true);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error streaming document by name for client: {clientId}, fileName: {fileName}");
                return StatusCode(500, "An error occurred while streaming the file.");
            }
        }

        private string GetContentType(string fileName)
        {
            var extension = Path.GetExtension(fileName).ToLowerInvariant();
            return extension switch
            {
                ".pdf" => "application/pdf",
                ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ".xls" => "application/vnd.ms-excel",
                ".csv" => "text/csv",
                ".png" => "image/png",
                ".jpg" or ".jpeg" => "image/jpeg",
                _ => "application/octet-stream"
            };
        }

        private async Task SaveDocumentRecord(object documentRecord)
        {
            var documentsFilePath = Path.Combine(_dataPath, "documents.json");
            var documents = new List<object>();

            if (System.IO.File.Exists(documentsFilePath))
            {
                try
                {
                    var existingContent = await System.IO.File.ReadAllTextAsync(documentsFilePath);
                    if (!string.IsNullOrEmpty(existingContent))
                    {
                        documents = JsonSerializer.Deserialize<List<object>>(existingContent) ?? new List<object>();
                    }
                }
                catch (JsonException)
                {
                    // If JSON is invalid, start with empty list
                    documents = new List<object>();
                }
            }

            documents.Add(documentRecord);

            var options = new JsonSerializerOptions
            {
                WriteIndented = true
            };

            var jsonContent = JsonSerializer.Serialize(documents, options);
            await System.IO.File.WriteAllTextAsync(documentsFilePath, jsonContent);
        }
    }
}
