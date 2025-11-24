// Neue PDF-Export-Funktion für Hochformat mit allen Anforderungen
// Diese Funktion ersetzt die alte createPDF Funktion

const createPDF = (withLogo, logoData, type, saturdayEvening, sundayMorning, hexToRgb, shortenName, allHolidays) => {
  const doc = new jsPDF('portrait', 'mm', 'a4'); // Hochformat A4: 210x297mm
  
  // Logo zentriert oben
  if (withLogo && logoData) {
    const logoWidth = 40;
    const logoHeight = logoWidth / 1.664;
    doc.addImage(logoData, 'PNG', (210 - logoWidth) / 2, 10, logoWidth, logoHeight);
  }
  
  // Überschrift
  const startY = withLogo ? 40 : 15;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(type === 'wirte' ? 'Wirte Liste' : 'Schießaufsicht Liste', 105, startY, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Erstellt am: ${new Date().toLocaleDateString('de-DE')}`, 105, startY + 6, { align: 'center' });
  
  let yPos = startY + 15;
  const rowHeight = 7;
  const colWidths = [20, 40, 70]; // Tag, Datum, Name
  const startX = 15;
  
  if (type === 'wirte') {
    // Samstag Schießabend Tabelle
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Samstag Schießabend (19:30-24:00)', 105, yPos, { align: 'center' });
    yPos += 8;
    
    // Header
    doc.setFontSize(9);
    doc.rect(startX, yPos, colWidths[0], rowHeight);
    doc.rect(startX + colWidths[0], yPos, colWidths[1], rowHeight);
    doc.rect(startX + colWidths[0] + colWidths[1], yPos, colWidths[2], rowHeight);
    doc.text('Tag', startX + colWidths[0]/2, yPos + 5, { align: 'center' });
    doc.text('Datum', startX + colWidths[0] + colWidths[1]/2, yPos + 5, { align: 'center' });
    doc.text('Name', startX + colWidths[0] + colWidths[1] + colWidths[2]/2, yPos + 5, { align: 'center' });
    yPos += rowHeight;
    
    // Daten
    doc.setFont('helvetica', 'normal');
    saturdayEvening.forEach(a => {
      const date = new Date(a.dateStr);
      const dayName = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][date.getDay()];
      const dateStr = date.toLocaleDateString('de-DE');
      const name = a.swappedWith ? `${a.swappedWith} (für ${shortenName(a.originalPerson)})` : a.person;
      
      // Hintergrund
      if (a.color) {
        const rgb = hexToRgb(a.color);
        doc.setFillColor(rgb.r, rgb.g, rgb.b);
        doc.rect(startX, yPos, colWidths[0] + colWidths[1] + colWidths[2], rowHeight, 'F');
      }
      
      // Rahmen
      doc.setDrawColor(0);
      doc.rect(startX, yPos, colWidths[0], rowHeight);
      doc.rect(startX + colWidths[0], yPos, colWidths[1], rowHeight);
      doc.rect(startX + colWidths[0] + colWidths[1], yPos, colWidths[2], rowHeight);
      
      // Text weiß
      doc.setTextColor(255, 255, 255);
      doc.text(dayName, startX + colWidths[0]/2, yPos + 5, { align: 'center' });
      doc.setFont('helvetica', 'bold');
      doc.text(dateStr, startX + colWidths[0] + colWidths[1]/2, yPos + 5, { align: 'center' });
      doc.setFont('helvetica', 'bold'); // Namen auch fett
      doc.text(name, startX + colWidths[0] + colWidths[1] + 2, yPos + 5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      
      yPos += rowHeight;
    });
    
    // Sonntag / Frühschoppen / Feiertage Tabelle
    yPos += 10;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Sonntag / Frühschoppen / Feiertage (10:00-12:00)', 105, yPos, { align: 'center' });
    yPos += 8;
    
    // Header
    doc.setFontSize(9);
    doc.rect(startX, yPos, colWidths[0], rowHeight);
    doc.rect(startX + colWidths[0], yPos, colWidths[1], rowHeight);
    doc.rect(startX + colWidths[0] + colWidths[1], yPos, colWidths[2], rowHeight);
    doc.text('Tag', startX + colWidths[0]/2, yPos + 5, { align: 'center' });
    doc.text('Datum', startX + colWidths[0] + colWidths[1]/2, yPos + 5, { align: 'center' });
    doc.text('Name', startX + colWidths[0] + colWidths[1] + colWidths[2]/2, yPos + 5, { align: 'center' });
    yPos += rowHeight;
    
    // Daten
    doc.setFont('helvetica', 'normal');
    sundayMorning.forEach(a => {
      const date = new Date(a.dateStr);
      const dayOfWeek = date.getDay();
      const dayName = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][dayOfWeek];
      const dateStr = date.toLocaleDateString('de-DE');
      const name = a.swappedWith ? `${a.swappedWith} (für ${shortenName(a.originalPerson)})` : a.person;
      
      // Prüfe ob unregelmäßig (Feiertag oder Samstag-Frühschoppen)
      const isIrregular = a.isHoliday || a.isSaturdayMorning;
      
      // Hintergrund
      if (a.color) {
        const rgb = hexToRgb(a.color);
        doc.setFillColor(rgb.r, rgb.g, rgb.b);
        doc.rect(startX, yPos, colWidths[0] + colWidths[1] + colWidths[2], rowHeight, 'F');
      }
      
      // Rahmen
      doc.setDrawColor(0);
      doc.rect(startX, yPos, colWidths[0], rowHeight);
      doc.rect(startX + colWidths[0], yPos, colWidths[1], rowHeight);
      doc.rect(startX + colWidths[0] + colWidths[1], yPos, colWidths[2], rowHeight);
      
      // Text weiß
      doc.setTextColor(255, 255, 255);
      
      // Tag fett wenn unregelmäßig
      if (isIrregular) {
        doc.setFont('helvetica', 'bold');
      }
      doc.text(dayName, startX + colWidths[0]/2, yPos + 5, { align: 'center' });
      
      // Datum immer fett
      doc.setFont('helvetica', 'bold');
      doc.text(dateStr, startX + colWidths[0] + colWidths[1]/2, yPos + 5, { align: 'center' });
      
      // Name fett
      doc.setFont('helvetica', 'bold');
      doc.text(name, startX + colWidths[0] + colWidths[1] + 2, yPos + 5);
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      
      yPos += rowHeight;
    });
  }
  
  // PDF speichern
  doc.save(`${type}-liste-${new Date().toISOString().split('T')[0]}.pdf`);
};
