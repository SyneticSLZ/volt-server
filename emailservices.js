async function generateEmailContent({ website, userPitch, Uname, To, Template }) {
    const response = await fetch('https://server.voltmailer.com/generate-email-content', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
            website, 
            userPitch, 
            Uname,
            To,
            Template
        })
    });

    if (!response.ok) {
        throw new Error(`Failed to generate email content: ${response.statusText}`);
    }

    return response.json();
}
async function sendEmailWithAttachments(mailbox, to, subject, body, signature, attachments, myemail) {
    try{
        console.log('=== Starting Email Attachment Processing ===');
        console.log('Recipient:', to);
        console.log('Number of attachments received:', attachments ? attachments.length : 0);
        
        const MAX_TOTAL_SIZE = 25 * 1024 * 1024; // 25MB
    let totalSize = 0;
    
    const validAttachments = Array.isArray(attachments) ? attachments : [];
    console.log('Valid attachments array:', validAttachments.length);

    const processedAttachments = validAttachments
    .filter(att => {
        if (!att || !att.data) {
            console.log('Skipping invalid attachment:', att?.name || 'unnamed', '- Missing data');
            return false;
        }
        return true;
    })
    .filter(att => {
        try {
        // Handle both full data URLs and raw base64
        const base64Data = att.data.includes('base64,') ? 
            att.data.split('base64,')[1] : 
            att.data;
            
        const size = Buffer.from(base64Data, 'base64').length;
        console.log('Attachment details:', {
            name: att.name,
            type: att.type,
            size: `${(size / 1024 / 1024).toFixed(2)}MB`,
            totalAccumulatedSize: `${(totalSize / 1024 / 1024).toFixed(2)}MB`,
            withinLimit: (totalSize + size <= MAX_TOTAL_SIZE)
        });
        if (totalSize + size <= MAX_TOTAL_SIZE) {
            totalSize += size;
            return true;
        }
        console.warn(`Skipping attachment ${att.name}: size limit exceeded`);
        return false;
    } catch (error) {
        console.warn(`Invalid attachment data for ${att.name}:`, error);
        return false;
    }
});
console.log('Successfully processed attachments:', processedAttachments.length);
console.log('Total size of attachments:', `${(totalSize / 1024 / 1024).toFixed(2)}MB`);
const htmlContent = `
<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <p>${body.replace(/\n/g, '<br>')}</p>
    ${signature ? `<div class="signature">${signature}</div>` : ''}
</div>
`;
// const accountGmail = mailbox.smtp.gmail


if (mailbox.gmail ){

// For Gmail
console.log('Using Gmail for sending');
const attachmentsFormatted = processedAttachments.map(att => {
   const base64Data = att.data.includes('base64,') ? 
       att.data.split('base64,')[1] : 
       att.data;
       
   console.log('Formatting attachment for Gmail:', {
       filename: att.name,
       type: att.type
   });

   return {
       filename: att.name,
       content: base64Data,
       encoding: 'base64',
       contentType: att.type
   };
});

console.log('Attempting to send email with', attachmentsFormatted.length, 'attachments');

const result = await sendEmailGMAIL(
   to, 
   subject, 
   body, 
   myemail, 
   mailbox.gmail, 
   htmlContent, 
   attachmentsFormatted
);

console.log('Email sent successfully with attachments');
return result;
} else {
        // For Mailjet
        const attachmentsFormatted = processedAttachments.map(att => ({
            'Content-Type': att.type,
            'Filename': att.name,
            'Base64Content': att.data.split('base64,')[1]
        }));

        const mailjetData = {
            FromEmail: mailbox.smtp.user,
            FromName: 'Alex',
            Subject: subject,
            'Text-part': body,
            'Html-part': htmlContent,
            Recipients: [{ Email: to }],
            Attachments: attachmentsFormatted
        };

        return mailjet.post('send').request(mailjetData);
    }
} catch (error) {
    console.error('=== Error in sendEmailWithAttachments ===');
    console.error('Error details:', error);
    console.error('Recipient:', to);
    console.error('Attempted attachments:', attachments?.length || 0);
    console.error('Full error:', error.stack);
    
    console.log('Attempting to send email without attachments as fallback');
    
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <p>${body.replace(/\n/g, '<br>')}</p>
            ${signature ? `<div class="signature">${signature}</div>` : ''}
        </div>
    `;

    const result = await sendEmailGMAIL(
        to, 
        subject, 
        body, 
        myemail, 
        mailbox.smtp.gmail, 
        htmlContent, 
        [] // Empty attachments array
    );

    console.log('Fallback email sent successfully without attachments');
    return result;
}
}

module.exports = {
    generateEmailContent,
    sendEmailWithAttachments
};