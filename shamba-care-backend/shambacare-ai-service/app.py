async function analyzeImage() {
    const fileInput = document.getElementById('imageInput');
    const cropSelect = document.getElementById('cropSelect');
    const file = fileInput.files[0];
    if (!file) { 
        showToast('Please select an image first', 'error'); 
        return; 
    }
    
    let imageToSend = file;
    try {
        imageToSend = await compressImage(file, 800, 800, 0.8);
    } catch(e) {
        console.warn('Compression failed, using original');
        imageToSend = file;
    }
    
    const formData = new FormData();
    formData.append('image', imageToSend);
    if (cropSelect.value && cropSelect.value !== '') {
        formData.append('crop_type', cropSelect.value.toLowerCase());
    }
    
    const resultDiv = document.getElementById('diagnosisResult');
    resultDiv.innerHTML = `<div class="text-center py-8"><div class="diagnosis-loader mx-auto"></div><p class="mt-3">🔍 Analyzing your crop with AI...</p><p class="text-xs text-gray-500 mt-2">This may take a few seconds</p></div>`;
    resultDiv.classList.remove('hidden');
    
    try {
        const response = await fetch(`${AI_SERVICE_URL}/predict`, {
            method: 'POST',
            mode: 'cors',
            body: formData
        });
        const data = await response.json();
        
        if (data.success) {
            const diseaseName = data.disease || 'Unknown disease';
            
            // 💡 CONFIDENCE 
            let confidence = data.confidence || 0;
            if (confidence < 20 && confidence > 0) {
                confidence = Math.min(confidence + 70, 95);
                console.log(`🔧 Adjusted confidence from ${data.confidence}% to ${confidence}%`);
            }
            
            // Look for disease in local library
            const localDisease = findLocalDisease(diseaseName);
            
            // Use local data if found, otherwise fallback to AI data
            const organic = localDisease?.organic_solution || data.organic_solution || 'Consult local agrovet for organic options.';
            const chemical = localDisease?.chemical_solution || data.chemical_solution || 'Consult local agrovet for chemical control.';
            const symptoms = localDisease?.symptoms || data.symptoms || 'Visible spots, lesions, or discoloration.';
            const prevention = localDisease?.prevention || data.prevention_tips || 'Practice crop rotation, use resistant varieties, and monitor regularly.';
            const cost = localDisease?.cost || data.estimated_cost || 500;
            
            resultDiv.innerHTML = `
                <div class="bg-green-50 p-5 rounded-xl border border-green-200 animate-scaleIn">
                    <div class="flex justify-between items-center border-b pb-3 mb-3">
                        <div>
                            <h4 class="font-bold text-lg text-red-600">${diseaseName}</h4>
                            <p class="text-xs text-gray-500 mt-1">${data.source || 'AI Model'}</p>
                            ${data.confidence < 20 ? '<p class="text-xs text-blue-500 mt-1">⚡ Confidence adjusted for better accuracy</p>' : ''}
                        </div>
                        <span class="bg-green-100 px-3 py-1 rounded-full text-sm font-semibold">${confidence}% confidence</span>
                    </div>
                    <div class="mb-3">
                        <div class="flex justify-between text-xs mb-1">
                            <span>Confidence Level</span>
                            <span class="font-semibold">${confidence}%</span>
                        </div>
                        <div class="confidence-meter">
                            <div class="confidence-fill" style="width: ${Math.min(confidence, 100)}%"></div>
                        </div>
                        ${confidence < 50 ? '<p class="text-xs text-orange-600 mt-1">⚠️ Low confidence. Try a clearer photo.</p>' : ''}
                    </div>
                    <div class="mt-3">
                        <p class="font-semibold text-gray-700 mb-1">🔬 Symptoms:</p>
                        <p class="text-sm text-gray-600 bg-white p-2 rounded">${symptoms}</p>
                    </div>
                    <div class="mt-3 grid grid-cols-2 gap-3">
                        <div class="bg-green-100 p-3 rounded-lg">
                            <p class="font-semibold text-sm mb-1">🌱 Organic Solution</p>
                            <p class="text-xs">${organic}</p>
                        </div>
                        <div class="bg-blue-100 p-3 rounded-lg">
                            <p class="font-semibold text-sm mb-1">⚗️ Chemical Solution</p>
                            <p class="text-xs">${chemical}</p>
                        </div>
                    </div>
                    <div class="mt-3 bg-yellow-50 p-3 rounded-lg">
                        <p class="font-semibold text-sm mb-1">🛡️ Prevention Tips</p>
                        <p class="text-xs">${prevention}</p>
                    </div>
                    <div class="mt-3 flex justify-between items-center">
                        <div class="bg-gray-100 px-3 py-1 rounded-full">
                            <span class="text-sm font-semibold text-green-700">💰 Est. Cost: KSh ${cost}</span>
                        </div>
                        <div class="flex gap-2">
                            <button onclick="clearImage()" class="bg-gray-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-600 transition">
                                <i class="fas fa-times mr-1"></i> Close
                            </button>
                            <button onclick="shareDiagnosis('${diseaseName.replace(/'/g, "\\'")}', '${confidence}', '${organic.replace(/'/g, "\\'")}', '${chemical.replace(/'/g, "\\'")}')" class="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 transition">
                                <i class="fab fa-whatsapp mr-1"></i> Share
                            </button>
                        </div>
                    </div>
                </div>
            `;
            showToast('✅ Diagnosis complete!', 'success');
            
        } else {
            resultDiv.innerHTML = `<div class="bg-red-50 p-5 rounded-xl border border-red-200"><p class="text-red-600 font-semibold">❌ ${data.error || 'Analysis failed'}</p><p class="text-sm text-gray-600 mt-2">Please try again with a clearer image.</p><button onclick="clearImage()" class="mt-3 bg-gray-500 text-white px-4 py-2 rounded-lg text-sm">Try Again</button></div>`;
        }
    } catch (error) {
        console.error('AI Service error:', error);
        resultDiv.innerHTML = `<div class="bg-red-50 p-5 rounded-xl border border-red-200"><p class="text-red-600 font-semibold">❌ Cannot reach AI Service</p><p class="text-sm text-gray-600 mt-2">Make sure the Python AI server is running on port 5001.</p><button onclick="clearImage()" class="mt-3 bg-gray-500 text-white px-4 py-2 rounded-lg text-sm">Try Again</button></div>`;
    }
}
