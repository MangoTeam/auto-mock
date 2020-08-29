#!/usr/bin/python3

import json

from typing import Dict, List

from dataclasses import dataclass, field
from enum import Enum
from dataclasses_json import dataclass_json

from subprocess import run, TimeoutExpired


from jinja2 import FileSystemLoader, Environment
from os.path import join, exists, getmtime

from alive_progress import alive_bar

import datetime
import os


config_path = 'benches.json'
evaluation_benchmarks = 'evaluation-current.json'
output_dir = 'eval/tmp/'
timeout_length = 60 * 2 # 30 mins; not currently used, set in Benchmarking.ts


@dataclass_json
@dataclass
class FocusSchema:
  # height: List[int] = field(default_factory=lambda: [0, 0])# always just 2 
  # width: List[int] = field(default_factory=lambda: [0, 0]) # always just 2
  root: str = 'TODO'
  script_key: str = 'TODO'

@dataclass_json
@dataclass
class BenchSchema:
  description: str = 'TODO'
  src: str = 'TODO'
  url: str = 'TODO'
  script_key: str = 'TODO'
  benches: Dict[str, FocusSchema] = field(default_factory=lambda: {})

@dataclass_json
@dataclass
class EvalSchema:
  eval: Dict[str, BenchSchema]

@dataclass_json
@dataclass
class OutputSchema:
  constraints: List[List[str]]


def all_items(tree): 
  yield tree
  for child in tree['children']:
    for item in all_items(child):
      yield item

def find(name: str, tree):
  for value in all_items(tree):
    if name == value['name']:
      return value
  raise Exception('missing element %s' % name)


def run_bench(parent: BenchSchema, local: FocusSchema, prefix: str, suffix: str, timeout: int = timeout_length, alg: str = 'hier', args: List[str] = []):
  with open('benches.json') as script_file:
    script_config = json.load(script_file)
  p_key, local_key = parent.script_key, local.script_key

  print(f"Running bench {p_key}, {local_key}")

  script_data = script_config[p_key][local_key]
  path = prefix + '/bench-%s-%s.log' % (local.script_key, suffix)
  if 'width' in script_data and 'height' in script_data:
    with open(path, 'w') as bench_out:
      run(['./bench.sh', p_key, local_key, alg, '--timeout', str(timeout), *args], stdout=bench_out, stderr=bench_out)
    print(f"Finished.")
    return parse_result_from_file(path, local.script_key)
  else:
    print('error: bad auto-mock script entry')
    print(parent)
    print(local)
    raise Exception()

# for each benchmark:

@dataclass_json
@dataclass
class BenchmarkSchema:
  accuracy: float
  error: float
  elems: int
  constraints: int
  prep: float
  resize: float
  synth: float
  name: str = 'empty'
  constraints_subproblems: List[float] = field(default_factory=lambda: [])

  finished: bool = True

  def csv_row(self):
    return '%s,%.3f,%d,%.3f,%d,%.3f,%.3f,%.3f' % (self.name, self.error, self.elems, self.accuracy, self.constraints, self.prep, self.resize, self.synth) if self.finished else '%s,-,-,-,-,-,-,-,-' % self.name

def aggregate_avg(xs: List[BenchmarkSchema], name: str):

  assert len(xs) > 0

  xs_valid = [x for x in xs if x.finished]

  fields = ['accuracy', 'error', 'elems', 'constraints', 'prep', 'resize', 'synth']

  kwargs = {}

  for fld in fields:
    view = [getattr(x, fld) for x in xs_valid]
    if len(view) > 0:
      avg_val = sum(view)/len(view)
      kwargs[fld] = avg_val
    else:
      return benchmark_error_value(name)
  kwargs['name'] = name

  return BenchmarkSchema(**kwargs)

def aggregate_sum(xs: List[BenchmarkSchema], name: str):

  assert len(xs) > 0

  xs_valid = [x for x in xs if x.finished]

  fields = ['accuracy', 'error', 'elems', 'constraints', 'prep', 'resize', 'synth']

  kwargs = {}

  for fld in fields:
    view = [getattr(x, fld) for x in xs_valid]
    if len(view) > 0:
      kwargs[fld] = sum(view)
    else:
      return benchmark_error_value(name)
  kwargs['name'] = name

  return BenchmarkSchema(**kwargs)

def benchmark_error_value(name: str):
  return BenchmarkSchema(0.0, 0.0, 0, 0, 0.0, 0.0, 0.0, name, [], False)
def make_table_header():
  return 'Name, Avg RMS, Number of elements, Accuracy, Number of constraints, Prep time, Resize time, Synth time'

def parse_result_from_file(log_output_fname: str, name) -> BenchmarkSchema:
  with open(log_output_fname, 'r') as log_output:
    kwargs: Dict[str, object] = {}
    parsing = False
    keys = ['accuracy', 'error', 'elems', 'constraints', 'prep', 'resize', 'synth']
    constraints = []
    for f_line in log_output:
      lines = f_line.split(' ')

      if len(lines) < 1: continue
      if lines[0] == 'INFO:mockdown.pruning.blackbox:@scaling_candidates':
        constraints.append(float(lines[1]))
      if lines[0][0:-1] == '{': 
        parsing = True
        continue
      if lines[0][0:-1] == '}': 
        parsing = False
        continue
      if parsing and lines[2][0:-1] in keys:
        val_str = lines[3][0:-1]
        if val_str[-1] == ',': val_str = val_str[0:-1]

        kwargs[lines[2][0:-1]] = eval(val_str)
    
    if len(kwargs) == 7:
      kwargs['name'] = name
      kwargs['finished'] = True
      kwargs['constraints_subproblems'] = constraints
      # print('parsed constraints to', constraints)
      return BenchmarkSchema(**kwargs)
    else:
      # print('')
      print('invalid parse of result in ' + log_output_fname)
      # raise Exception('foo')
      return benchmark_error_value(name)

      

def run_all_macro(*args : str, examples: int = 10):
  results: List[BenchmarkSchema] = []
  time = datetime.datetime.now().time()
  prefix = output_dir + 'macro-' + time.strftime("%Y-%m-%d-%H-%M-%S")
  os.mkdir(prefix)
  results_fname = prefix + '/macro_results.csv'
  with open('evaluation-current.json') as eval_file:
    benches: EvalSchema = EvalSchema.schema().loads(eval_file.read())
  # open(results_fname, 'w').close()

  iters = 3
  timeout = 600 * 3 # 30 minutes

  total_work = 0
  for root_name, bench in benches.eval.items():
    if root_name == 'synthetic': continue
    if len(args) > 0 and not root_name in args: continue

    total_work += iters
  
  print('starting macrobenchmarks')
  print('worst case amount of work in seconds:', total_work * timeout)

  

  with alive_bar(total_work) as bar:
    with open(results_fname, 'a') as results_file:
      print(make_table_header(), file=results_file)
      
      results = []
      for iter in range(iters):
        for root_name, bench in benches.eval.items():
          # if root_name != 'duckduckgo': continue
          if root_name == 'synthetic': continue # synthetic benchmarks are not part of macro because of reasons...TODO
          if len(args) > 0 and not root_name in args: continue
          print('running macro %s' % root_name)

          try:
            b_args = ['--loclearn', 'bayesian', '--train-size', str(examples)]
            result = run_bench(bench, bench.benches['main'], prefix, str(iter), timeout=timeout, args=b_args)
            # result = parse_result_from_file(output_dir + 'bench-%s.log' % bench.benches['main'].script_key, bench.benches['main'].script_key)
          except Exception as e:
            print('exception: ')
            print(e)
            result = benchmark_error_value(root_name)
          
          results.append(result)
          bar()

          print(result.csv_row(), file=results_file)
    print('done! results printed to %s' % results_fname)

def run_all_micro(*args: str, train_examples: int = 3):
  results: List[BenchmarkSchema] = []
  timeout = 180 # 3 minutes
  iters = 3

  total_work = 0

  time = datetime.datetime.now().time()
  prefix = output_dir + '/micro-' + time.strftime("%Y-%m-%d-%H-%M-%S")
  os.mkdir(prefix)
  results_fname = prefix + '/micro_results.csv'

  with open('evaluation-current.json') as eval_file:
    benches: EvalSchema = EvalSchema.schema().loads(eval_file.read())
  open(results_fname, 'w').close()

  for root_name, bench in benches.eval.items():
    total_work += len(bench.benches) * iters
  
  print('starting all microbenchmarks')
  print('worst-case time in seconds: ', total_work * timeout)
  with alive_bar(total_work) as bar:
    with open(results_fname, 'a') as results_file:
      print('Group, ' + make_table_header(), file=results_file)
      
      for root_name, bench in benches.eval.items():

        if len(args) > 0:
          if not root_name in args: continue
        
        print('running group %s' % root_name)
        # current = ['duckduckgo', 'fwt-running']
        # if not root_name in current: continue

        results = []

        for micro_name, micro in bench.benches.items():
          for iter in range(iters):
            if micro_name == "main": continue

            try:
              b_args = ['--loclearn', 'bayesian', '--train-size', str(train_examples)]
              result = run_bench(bench, micro, prefix, str(iter), timeout=timeout, args=b_args)
              # result = parse_result_from_file(output_dir + 'bench-%s.log' % micro.script_key, micro.script_key)
            except Exception as e:
              print('exception: ')
              print(e)
              result = benchmark_error_value(micro_name)

            results.append(result)
            bar()
          
            print(root_name + ', ' + result.csv_row(), file=results_file)

  print('done! results printed to %s' % results_fname)

def generate_micros(*args: str):
  with open('evaluation-current.json') as eval_file:
    benches: EvalSchema = EvalSchema.schema().loads(eval_file.read())
    # print(benches)

  for root_name, bench in benches.eval.items():
    if root_name == 'synthetic': continue # synthetic benchmarks are not grouped like other micros
    if len(args) > 0:
      if not root_name in args: continue
    print('loading root %s' % bench.benches['main'].script_key)
    with open('bench_cache/%s.json' % bench.benches['main'].script_key) as bench_file:
      root_experiment = json.load(bench_file)

    new_root_config = {bench.script_key : {}}

    for bench_name, details in bench.benches.items():
      if bench_name == 'main': continue

      search_name = details.root
      outbench = {'name': root_name + '-' + bench_name}
      train, test = [find(search_name, tree) for tree in root_experiment['train']], [find(search_name, tree) for tree in root_experiment['test']]

      all_values = train + test

      hs, ws = [v['height'] for v in all_values], [v['width'] for v in all_values]

      benchopts = {}

      benchopts['height'] = {'low': min(hs), 'high': max(hs)}
      benchopts['width'] = {'low': min(ws), 'high': max(ws)}

      for prop in ['trainSeed', 'testSeed']:
        benchopts[prop] = root_experiment['bench'][prop]
      
      benchopts['testSize'] = len(test)
      benchopts['trainSize'] = len(train)

      outbench['bench'] = benchopts
      outbench['train'] = train
      outbench['test'] = test

      with open('bench_cache/%s.json' % details.script_key, 'w') as outbfile:
        json.dump(outbench, outbfile)

    for bench_name, details in bench.benches.items():
      print('loading %s' % details.script_key)
      with open('bench_cache/%s.json' % details.script_key) as outbfile:
        experiment = json.load(outbfile)
      
      new_config = {
        # 'description': 
        'height' : experiment['bench']['height'],
        'width' : experiment['bench']['width']  
      }

      new_root_config[bench.script_key][details.script_key] = new_config 


    with open('new-config-%s.json' % bench.script_key, 'w') as outfile:
      json.dump(new_root_config, outfile)


@dataclass
class NoiseResult:
  noise: float
  examples: int
  runs: List[BenchmarkSchema]
  name: str
  alg: str

  def fmt_run(self, run: BenchmarkSchema) -> str:
    if run.finished:
      # algorithm, examples, noise, accuracy, RMS, synth time, timeout (yes/no) 
      return "%s, %s, %d, %.2f, %.2f, %.2f, %.2f" % (self.name, self.alg, self.examples, self.noise, run.accuracy, run.error, run.synth) 
    else:
      return "%s, %s, %d, %.2f, -, -, -" % (self.name, self.alg, self.examples, self.noise)

  def to_csv_str(self) -> str:
    return '\n'.join([self.fmt_run(x) for x in self.runs])

def make_noise_header() -> str:
  return "benchmark, algorithm, examples, noise, accuracy, RMS, synth time"

def run_noisy_eval_bayes(*args: str):
  with open('evaluation-current.json') as eval_file:
    benches: EvalSchema = EvalSchema.schema().loads(eval_file.read())
  

  time = datetime.datetime.now().time()
  prefix = output_dir + '/noisy-bayes-' + time.strftime("%Y-%m-%d-%H-%M-%S")
  os.mkdir(prefix)
  results_fname = prefix + 'noisy_results_bayesian.csv'

  with open(results_fname, 'a') as results_file:
    print(make_noise_header(), file=results_file)


  # iters = 1
  iters = 3
  timeout = 60

  results = []
  noises = [0.01, 0.05, 0.5]
  # noises = [0.0]
  train_size = 5

  totalIters = (iters * len(noises)) * sum([len(bench.benches) - 1 if len(args) == 0 or b_name in args else 0 for b_name, bench in benches.eval.items()])

  print('total worst case minutes:', totalIters)
  
  print('starting noisy bayesian experiment')

  with alive_bar(totalIters) as bar:
    for root_name, bench in benches.eval.items():
      print('starting group', root_name)
      if len(args) > 0:
        if not root_name in args: 
          print('skipping')
          continue

  
      for micro_name, micro in bench.benches.items():
        if micro_name == "main": continue
        for noise in noises:
          runs = []
          for iter in range(iters):
            try:
              bench_args = ['--noise', str(noise), '--train-size', str(train_size), '--loclearn', 'bayesian']
              hier_result = run_bench(bench, micro, prefix, str(iter), timeout=timeout, args=bench_args)
              # result = parse_result_from_file(output_dir + 'bench-%s.log' % micro.script_key, micro.script_key)
            except Exception as e:
              print('exception: ')
              print(e)
              hier_result = benchmark_error_value(micro_name)

            runs.append(hier_result)
            bar()
          result = NoiseResult(noise, train_size, runs, micro.script_key, 'bayesian')
          results.append(result)

          with open(results_fname, 'a') as results_file:
            print(result.to_csv_str(), file=results_file)
            print('updated results file %s' % results_fname)
            
        
def run_noisy_eval_heuristic(*args: str):
  with open('evaluation-current.json') as eval_file:
    benches: EvalSchema = EvalSchema.schema().loads(eval_file.read())
  
  time = datetime.datetime.now().time()
  prefix = output_dir + '/noisy-heuristic-' + time.strftime("%Y-%m-%d-%H-%M-%S")
  os.mkdir(prefix)
  results_fname = prefix + 'noisy_results_bayesian.csv'

  with open(results_fname, 'a') as results_file:
    print(make_noise_header(), file=results_file)


  iters = 3
  timeout = 60

  results = []
  noises = [0.01, 0.05]
  train_size = 5

  totalIters = (1 + iters * len(noises)) * sum([len(bench.benches) - 1 if len(args) == 0 or b_name in args else 0 for b_name, bench in benches.eval.items()])

  print('total worst case seconds:', totalIters * 60)
  
  print('starting noisy heuristic experiment')

  with alive_bar(totalIters) as bar:
    for root_name, bench in benches.eval.items():
      print('starting group', root_name)
      if len(args) > 0:
        if not root_name in args: 
          print('skipping')
          continue

  
      for micro_name, micro in bench.benches.items():
        
        if micro_name == "main": continue

        try:
          bench_args = ['--train-size', str(train_size), '--loclearn', 'heuristic']
          plain_result = run_bench(bench, micro, prefix, "-base", timeout=timeout, args=bench_args)
          # result = parse_result_from_file(output_dir + 'bench-%s.log' % micro.script_key, micro.script_key)
        except Exception as e:
          print('exception: ')
          print(e)
          plain_result = benchmark_error_value(micro_name)

        bar()
        result = NoiseResult(0.0, train_size, [plain_result], micro.script_key, 'heuristic')
        with open(results_fname, 'a') as results_file:
          print(result.to_csv_str(), file=results_file)
        results.append(result)

        
        for noise in noises:
          runs = []
          for iter in range(iters):
            try:
              bench_args = ['--noise', str(noise), '--train-size', str(train_size), '--loclearn', 'heuristic']
              plain_result = run_bench(bench, micro, prefix, str(iter), timeout=timeout, args=bench_args)
              # result = parse_result_from_file(output_dir + 'bench-%s.log' % micro.script_key, micro.script_key)
            except Exception as e:
              print('exception: ')
              print(e)
              plain_result = benchmark_error_value(micro_name)

            runs.append(plain_result)
            bar()
          result = NoiseResult(noise, train_size, runs, micro.script_key, 'heuristic')
          results.append(result)

          with open(results_fname, 'a') as results_file:
            print(result.to_csv_str(), file=results_file)
            print('updated results file %s' % results_fname)
  
  
def run_scaling_cmd(group: str, particular: str, train_size: int, rows: int, alg: str, timeout: int, prefix: str, suffix: str) -> BenchmarkSchema:

  print(f"Running scaling bench {group}, {particular}")
  path = prefix + '/bench-scaling-%d-%s-%s.log' % (rows, particular, suffix)
  with open(path, 'w') as bench_out:
    run(['./bench_hier.sh', group, particular, '--alg', alg, '--timeout', str(timeout), '--train-size', str(train_size), '--rows', str(rows)], stdout=bench_out, stderr=bench_out)
    print(f"Finished.")
    return parse_result_from_file(path, particular)


@dataclass
class ScalingResult:
  rows: int
  runs: List[BenchmarkSchema]
  name: str
  alg: str

  def fmt_run(self, run: BenchmarkSchema) -> str:
    if run.finished:
      # name, algorithm, rows, size, synth time, max size, mean size
      sizes = [x for x in run.constraints_subproblems if x > 0]
      if len(sizes) == 0:
        sizes = [0.0] 
      max_size = max(sizes)
      mean_size = sum(sizes)/len(sizes)
      return "%s, %s, %d, %d, %.2f, %.2f, %.2f" % (self.name, self.alg, self.rows, run.elems, run.synth, max_size, mean_size) 
    else:
      return "%s, %s, %d, %d, -, -, -" % (self.name, self.alg, self.rows, run.elems)

  def to_csv_str(self) -> str:
    return '\n'.join([self.fmt_run(x) for x in self.runs])

def make_scaling_header() -> str:
  return "name, algorithm, rows, size, synth time, max size, mean size"

# run all the benchmarks in arrays.json, with rows ranging from 1 to 10. 
# if rows is bigger than the size of the benchmark then do not run.
def run_hier_eval(hier_or_flat: bool, *args: str):
  hier_benches = 'arrays.json'
  with open(hier_benches, 'r') as arr_file:
    benchmarks = json.load(arr_file)

  iters = 5
  rows = 10
  timeout = 120
  train_size = 4

  total_work = 0

  

  if hier_or_flat:
    alg = 'hier'
  else:
    alg = 'base'

  print('starting scaling experiment for ', alg)

  time = datetime.datetime.now().time()
  prefix = output_dir + '/scaling-%s-' % alg + time.strftime("%Y-%m-%d-%H-%M-%S")
  os.mkdir(prefix)
  results_fname = prefix + 'results.csv'

  open(results_fname, 'w').close()
  with open(results_fname, 'a') as results_file:
    print(make_scaling_header(), file=results_file)

  for _, benches in benchmarks.items():
    for bname, body in benches.items():
      if len(args) > 0 and bname not in args: continue
      assert "items" in body
      if body['items']:
        amnt = min(rows, len(body["items"] or []))
      else:
        amnt = rows
      total_work += iters * amnt

  with alive_bar(total_work) as bar:
    for group, benches in benchmarks.items():
      for bname, body in benches.items():
        if len(args) > 0 and bname not in args: continue
        print('starting scaling experiment for ', bname)

        if body["items"]:
          amnt = min(rows, len(body["items"]))
        else:
          amnt = rows

        vals = list(range(1, amnt + 1))
        # vals.reverse()
        for row in vals:
          runs = []
          for iter in range(iters):
            try:
              run = run_scaling_cmd(group, bname, train_size, row, alg, timeout, prefix, str(iter))
            except Exception as e:
              print('failed')
              raise e
              run = benchmark_error_value(bname)
            runs.append(run)
            bar()
          result = ScalingResult(row, runs, bname, alg)
          with open(results_fname, 'a') as results_file:
            print(result.to_csv_str(), file=results_file)
            print('updated results file %s' % results_fname)
        
          



def build_hier_config():
  hier_benches = "arrays.json"
  with open(hier_benches, 'r') as h_b_file:
    array_benches = json.load(h_b_file)

  output = {}
  # print('array benches: ')
  # print(array_benches)

  for _, benches in array_benches.items():
    for bname, body in benches.items():
      assert "items" in body
      output[bname] = body["items"]

  hier_config = "hier-config.json"
  with open(hier_config, 'w') as h_conf_file:
    json.dump(output, h_conf_file)
  print('made the config in %s' % hier_config)

loader = FileSystemLoader('./eval/templates/')
if __name__ == "__main__":

  # run_all_micro('synthetic', train_examples=3)
  # run_noisy_eval_bayes('synthetic')
  # run_noisy_eval_heuristic('synthetic')
  run_all_macro('overview', examples=10)
  run_all_macro('overview', examples=3)
  run_all_micro('overview', train_examples=10)
  run_all_micro('overview', train_examples=3)
  
  
  # generate_micros('overview')
  # run_hier_eval(True, 'ddg-minipages', 'ace-options-focus', 'ieee-authors', 'ieee-articles', 'ieee-conferences')
  # run_noisy_eval_heuristic()
  # run_noisy_eval_bayes()
  # run_noisy_eval_bayes('icse', 'hackernews', 'ace', 'fwt-main')
  # build_hier_config()
  # run_hier_eval(True)
  # run_hier_eval(False)
  # run_all_macro('duckduckgo', examples=3)
  # run_all_micro()