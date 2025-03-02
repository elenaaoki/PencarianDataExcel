    const databasesContainer = document.getElementById('databasesContainer');
    const resultsContainer = document.getElementById('resultsContainer');
    const searchBox = document.getElementById('searchBox');
    const addDatabaseBtn = document.getElementById('addDatabaseBtn');

    let databaseIndex = 0;
    let databases = {};
    let searchTimeout;

    function showToast(message, type = 'success') {
      Toastify({
        text: message,
        duration: 3000,
        gravity: "top",
        position: 'right',
        backgroundColor: type === 'success' ? '#8B5CF6' : '#dc2626'
      }).showToast();
    }

    function showLoading() {
      const loader = document.createElement('div');
      loader.className = 'loading';
      document.body.appendChild(loader);
      return loader;
    }

    function hideLoading(loader) {
      loader.remove();
    }

    function debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    }

    function copyToClipboard(text, element) {
      navigator.clipboard.writeText(text).then(() => {
        showToast('Teks berhasil disalin!');
        element.textContent = 'Tersalin!';
        setTimeout(() => {
          element.textContent = 'Salin';
        }, 2000);
      }).catch(() => {
        showToast('Gagal menyalin teks', 'error');
      });
    }

    // New function to add drag-to-scroll behavior to an element
    function enableDragScroll(element) {
      let isDown = false;
      let startX;
      let scrollLeft;

      element.addEventListener('mousedown', (e) => {
        // Prevent text selection during drag
        if (e.target.tagName !== 'BUTTON') {
          isDown = true;
          element.classList.add('dragging');
          startX = e.pageX - element.offsetLeft;
          scrollLeft = element.scrollLeft;
          e.preventDefault();
        }
      });

      element.addEventListener('mouseleave', () => {
        isDown = false;
        element.classList.remove('dragging');
      });

      element.addEventListener('mouseup', () => {
        isDown = false;
        element.classList.remove('dragging');
      });

      element.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - element.offsetLeft;
        const walk = (x - startX) * 2; // Scroll speed multiplier
        element.scrollLeft = scrollLeft - walk;
      });

      // Touch events for mobile support
      element.addEventListener('touchstart', (e) => {
        if (e.target.tagName !== 'BUTTON') {
          isDown = true;
          element.classList.add('dragging');
          startX = e.touches[0].pageX - element.offsetLeft;
          scrollLeft = element.scrollLeft;
        }
      });

      element.addEventListener('touchend', () => {
        isDown = false;
        element.classList.remove('dragging');
      });

      element.addEventListener('touchmove', (e) => {
        if (!isDown) return;
        const x = e.touches[0].pageX - element.offsetLeft;
        const walk = (x - startX) * 2;
        element.scrollLeft = scrollLeft - walk;
      });
    }

    addDatabaseBtn.addEventListener('click', () => {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.xlsx, .xls';
      fileInput.style.display = 'none';
      fileInput.addEventListener('change', (event) => handleFile(event, databaseIndex++));
      fileInput.click();
    });

    async function handleFile(event, dbIndex) {
      const file = event.target.files[0];
      if (!file) return;

      const loader = showLoading();
      try {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });

        databases[dbIndex] = {
          fileName: file.name,
          sheetsData: {},
          activeSheets: []
        };

        workbook.SheetNames.forEach(sheetName => {
          const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
          databases[dbIndex].sheetsData[sheetName] = sheetData;
        });

        renderDatabaseControls();
        renderSearchResults();
        showToast('File berhasil ditambahkan!');
      } catch (error) {
        showToast('Gagal memproses file', 'error');
      }
      hideLoading(loader);
    }

    function renderDatabaseControls() {
      databasesContainer.innerHTML = '';

      Object.keys(databases).forEach(dbIndex => {
        const db = databases[dbIndex];
        const dbContainer = document.createElement('div');
        dbContainer.className = 'file-container';

        const dbLabel = document.createElement('div');
        dbLabel.className = 'database-label';
        
        const titleSpan = document.createElement('span');
        titleSpan.textContent = `File: ${db.fileName}`;
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.textContent = '✖';
        removeBtn.addEventListener('click', () => {
          delete databases[dbIndex];
          renderDatabaseControls();
          renderSearchResults();
          showToast('File berhasil dihapus');
        });
        
        dbLabel.appendChild(titleSpan);
        dbLabel.appendChild(removeBtn);

        const sheetControls = document.createElement('div');
        sheetControls.className = 'database-controls';

        Object.keys(db.sheetsData).forEach(sheetName => {
          const sheetControl = document.createElement('div');
          sheetControl.className = 'sheet-control';

          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.id = `sheet-${dbIndex}-${sheetName}`;
          checkbox.checked = db.activeSheets.includes(sheetName);
          checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
              db.activeSheets.push(sheetName);
            } else {
              db.activeSheets = db.activeSheets.filter(name => name !== sheetName);
            }
            renderSearchResults();
          });

          const label = document.createElement('label');
          label.htmlFor = `sheet-${dbIndex}-${sheetName}`;
          label.textContent = sheetName;

          sheetControl.appendChild(checkbox);
          sheetControl.appendChild(label);
          sheetControls.appendChild(sheetControl);
        });

        dbContainer.appendChild(dbLabel);
        dbContainer.appendChild(sheetControls);
        databasesContainer.appendChild(dbContainer);
      });
    }

    function renderSearchResults() {
      const keyword = searchBox.value.toLowerCase().trim();
      resultsContainer.innerHTML = '';

      Object.keys(databases).forEach(dbIndex => {
        const db = databases[dbIndex];

        db.activeSheets.forEach(sheetName => {
          const data = db.sheetsData[sheetName];
          
          // Only filter out completely empty rows (where ALL cells are empty)
          const cleanData = data.filter((row, index) => {
            if (index === 0) return true; // Keep header row
            if (!row) return false; // Skip undefined/null rows
            
            // Check if the entire row is empty (all cells are empty/undefined/null)
            const isCompletelyEmpty = row.every(cell => 
              cell === undefined || cell === null || cell === ''
            );
            
            return !isCompletelyEmpty;
          });

          // Only show filtered data if it contains matching content
          const filteredData = cleanData.filter((row, index) => {
            if (index === 0) return true;
            return keyword ? row.some(cell => 
              cell !== undefined && String(cell).toLowerCase().includes(keyword)
            ) : true;
          });

          // Only create table if there's data to show (more than just header)
          if (filteredData.length > 1) {
            const table = createTable(filteredData, dbIndex, sheetName);
            resultsContainer.appendChild(table);
          }
        });
      });
    }

    function createTable(data, dbIndex, sheetName) {
      const tableContainer = document.createElement('div');
      tableContainer.className = 'table-container';

      const tableHeader = document.createElement('div');
      tableHeader.className = 'table-header';

      const titleSpan = document.createElement('span');
      titleSpan.textContent = `${databases[dbIndex].fileName} - ${sheetName}`;
      
      const copyBtn = document.createElement('button');
      copyBtn.className = 'table-copy-btn';
      copyBtn.textContent = 'Salin Semua';
      copyBtn.addEventListener('click', () => {
        const textToCopy = data.slice(1).map(row => row.join('\t')).join('\n');
        copyToClipboard(textToCopy, copyBtn);
      });

      tableHeader.appendChild(titleSpan);
      tableHeader.appendChild(copyBtn);
      tableContainer.appendChild(tableHeader);

      // Add a wrapper div for horizontal scrolling
      const tableScrollContainer = document.createElement('div');
      tableScrollContainer.className = 'table-scroll-container';
      
      const table = document.createElement('table');
      const thead = document.createElement('thead');
      const tbody = document.createElement('tbody');

      if (data.length > 0) {
        // Find max columns for consistent rendering
        const maxCols = data.reduce((max, row) => Math.max(max, row.length), 0);
        
        // Header row
        const headerRow = document.createElement('tr');
        // Ensure headers match the max column count
        for (let i = 0; i < maxCols; i++) {
          const th = document.createElement('th');
          th.textContent = data[0][i] || '';
          headerRow.appendChild(th);
        }
        thead.appendChild(headerRow);

        // Data rows
        data.slice(1).forEach(row => {
          const tr = document.createElement('tr');
          
          // Ensure all rows have the same number of columns
          for (let i = 0; i < maxCols; i++) {
            const td = document.createElement('td');
            const cellValue = row[i];
            
            // Keep empty cells empty but preserve their position
            td.textContent = cellValue !== undefined ? cellValue : '';

            if (cellValue !== undefined && cellValue !== null && cellValue !== '') {
              const copyBtn = document.createElement('button');
              copyBtn.className = 'copy-btn';
              copyBtn.textContent = 'Salin';
              copyBtn.addEventListener('click', () => {
                copyToClipboard(cellValue, copyBtn);
              });
              td.appendChild(copyBtn);
            }

            tr.appendChild(td);
          }
          tbody.appendChild(tr);
        });
      }

      table.appendChild(thead);
      table.appendChild(tbody);
      tableScrollContainer.appendChild(table);
      tableContainer.appendChild(tableScrollContainer);
      
      // Apply drag-to-scroll functionality to the table scroll container
      enableDragScroll(tableScrollContainer);
      
      return tableContainer;
    }

    const debouncedSearch = debounce(() => renderSearchResults(), 300);
    searchBox.addEventListener('input', debouncedSearch);
