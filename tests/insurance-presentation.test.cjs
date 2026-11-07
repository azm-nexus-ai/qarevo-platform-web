const assert=require('node:assert/strict')
const test=require('node:test')
const fs=require('node:fs')
const vm=require('node:vm')
const ts=require('typescript')
const compiled={exports:{}}
const code=ts.transpileModule(fs.readFileSync('lib/insurance-presentation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
vm.runInNewContext(code,{module:compiled,exports:compiled.exports})
const {insurancePresentation,declaredDoctorFundingOptions}=compiled.exports

test('complete membership details, future card dates and legacy verification strings never establish coverage',()=>{
  for(const insurance_type of ['GKV','PKV'])for(const status of ['active','verified','covered']){
    const presentation=insurancePresentation({insurance_type,insurance_provider_name:'Synthetic insurer',insurance_number:'A123456789',insured_status:'SELF_INSURED',validity_end:'2099-12-31',status,coverage_verified:true,verification_status:'VERIFIED'})
    assert.equal(presentation.label,'Insurance details recorded')
    assert.equal(presentation.verificationLabel,'Not verified')
    assert.notEqual(presentation.tone,'success')
    assert.match(presentation.notice,/Coverage has not been verified/)
    assert.equal(presentation.membershipLabel,'Self-insured')
  }
})

test('missing details and incomplete insurance are distinguished from a recorded self-pay preference',()=>{
  assert.equal(insurancePresentation(null).label,'No insurance details recorded')
  assert.equal(insurancePresentation({}).fundingLabel,'Funding type not recorded')
  assert.equal(insurancePresentation({insurance_type:'GKV'}).label,'Insurance details incomplete')
  assert.equal(insurancePresentation({insurance_type:'GKV'}).verificationLabel,'Not verified')
  const self=insurancePresentation({insurance_type:'SELF_PAY'})
  assert.equal(self.label,'Self-pay preference recorded')
  assert.match(self.notice,/does not confirm a consultation price or a payment agreement/)
})

test('unrecognised membership status is never presented as an eligibility decision',()=>{
  for(const insured_status of ['ACTIVE','VERIFIED','COVERED','unexpected',null]){
    assert.equal(insurancePresentation({insurance_type:'PKV',insured_status}).membershipLabel,'Not recorded')
  }
})

test('doctor-declared funding options have no invented self-pay default or URL-derived coverage claim',()=>{
  assert.equal(declaredDoctorFundingOptions(undefined),'Not provided')
  assert.equal(declaredDoctorFundingOptions([]),'Not provided')
  assert.equal(declaredDoctorFundingOptions(['GKV',' PKV ','GKV','',null]),'GKV, PKV')
})
